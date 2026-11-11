/*
 * Copyright (c) 2021-2022, 2026 Taner Sener
 *
 * This file is part of FFmpegKitNext.
 *
 * FFmpegKitNext is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * FFmpegKitNext is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General License for more details.
 *
 * You should have received a copy of the GNU Lesser General License
 * along with FFmpegKitNext. If not, see <http://www.gnu.org/licenses/>.
 *
 * Ported from FFmpegKitNext's FFmpegKitReactNativeModule (v9.0.2) to a New Architecture only
 * TurboModule for @wekor/react-native-ffmpeg.
 */

#import "ReactNativeFFmpeg.h"

#import <ffmpegkit/ArchDetect.h>
#import <ffmpegkit/FFmpegKit.h>
#import <ffmpegkit/FFmpegKitConfig.h>
#import <ffmpegkit/FFmpegKitInputBuffer.h>
#import <ffmpegkit/FFmpegKitOutputBuffer.h>
#import <ffmpegkit/FFmpegKitStreamInput.h>
#import <ffmpegkit/FFmpegKitStreamOutput.h>
#import <ffmpegkit/FFprobeKit.h>
#import <ffmpegkit/MediaInformation.h>
#import <ffmpegkit/MediaInformationJsonParser.h>
#import <ffmpegkit/Packages.h>

#include <atomic>
#include <climits>
#include <cmath>

namespace {

NSString *const kPlatformName = @"ios";

// Session types, as JS reads them from the `type` key.
int const kSessionTypeFFmpeg = 1;
int const kSessionTypeFFprobe = 2;
int const kSessionTypeMediaInformation = 3;

NSString *const kWrongSessionType = @"A session is found but it does not have the correct type.";

#pragma mark - Rejections

void rejectSessionNotFound(RCTPromiseRejectBlock reject)
{
  reject(@"SESSION_NOT_FOUND", @"Session not found.", nil);
}

void rejectUnsupported(RCTPromiseRejectBlock reject)
{
  reject(@"unsupported", @"Not supported on iOS platform.", nil);
}

void rejectException(RCTPromiseRejectBlock reject, NSString *code, NSException *exception)
{
  reject(code, exception.reason ?: exception.name, nil);
}

/** The caller's wait timeout, or FFmpegKit's default when it is missing or negative. */
int timeoutOrDefault(NSNumber *waitTimeout)
{
  if (waitTimeout != nil && waitTimeout.intValue >= 0) return waitTimeout.intValue;
  return AbstractSessionDefaultTimeoutForAsynchronousMessagesInTransmit;
}

#pragma mark - Conversions

NSNumber *millisecondsOf(NSDate *date)
{
  return @([date timeIntervalSince1970] * 1000);
}

NSDictionary *_Nullable mediaInformationDictionary(MediaInformation *_Nullable mediaInformation)
{
  if (mediaInformation == nil) return nil;
  NSDictionary *allProperties = [mediaInformation getAllProperties];
  return allProperties != nil ? [allProperties copy] : @{};
}

NSDictionary *_Nullable sessionDictionary(id<Session> _Nullable session)
{
  if (session == nil) return nil;

  NSMutableDictionary *dictionary = [NSMutableDictionary dictionaryWithCapacity:6];
  dictionary[@"sessionId"] = @([session getSessionId]);
  dictionary[@"createTime"] = millisecondsOf([session getCreateTime]);
  dictionary[@"startTime"] = millisecondsOf([session getStartTime]);
  dictionary[@"command"] = [session getCommand];

  if ([session isFFmpeg]) {
    dictionary[@"type"] = @(kSessionTypeFFmpeg);
  } else if ([session isFFprobe]) {
    dictionary[@"type"] = @(kSessionTypeFFprobe);
  } else if ([session isMediaInformation]) {
    MediaInformationSession *mediaInformationSession = (MediaInformationSession *)session;
    dictionary[@"mediaInformation"] = mediaInformationDictionary([mediaInformationSession getMediaInformation]);
    dictionary[@"type"] = @(kSessionTypeMediaInformation);
  }
  return dictionary;
}

NSDictionary *logDictionary(Log *log)
{
  return @{
    @"sessionId" : @([log getSessionId]),
    @"level" : @([log getLevel]),
    @"message" : [log getMessage] ?: @"",
  };
}

NSDictionary *statisticsDictionary(Statistics *statistics)
{
  return @{
    @"sessionId" : @([statistics getSessionId]),
    @"videoFrameNumber" : @([statistics getVideoFrameNumber]),
    @"videoFps" : @([statistics getVideoFps]),
    @"videoQuality" : @([statistics getVideoQuality]),
    @"size" : @([statistics getSize]),
    @"time" : @([statistics getTime]),
    @"bitrate" : @([statistics getBitrate]),
    @"speed" : @([statistics getSpeed]),
  };
}

NSArray *logArray(NSArray *logs)
{
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:logs.count];
  for (Log *log in logs) [array addObject:logDictionary(log)];
  return array;
}

NSArray *statisticsArray(NSArray *statistics)
{
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:statistics.count];
  for (Statistics *item in statistics) [array addObject:statisticsDictionary(item)];
  return array;
}

NSArray *sessionArray(NSArray *sessions)
{
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:sessions.count];
  for (id<Session> session in sessions) [array addObject:sessionDictionary(session)];
  return array;
}

NSNumber *sessionStateNumber(SessionState sessionState)
{
  switch (sessionState) {
    case SessionStateCreated:
      return @0;
    case SessionStateRunning:
      return @1;
    case SessionStateFailed:
      return @2;
    case SessionStateCompleted:
    default:
      return @3;
  }
}

NSNumber *logRedirectionStrategyNumber(LogRedirectionStrategy logRedirectionStrategy)
{
  switch (logRedirectionStrategy) {
    case LogRedirectionStrategyAlwaysPrintLogs:
      return @0;
    case LogRedirectionStrategyPrintLogsWhenNoCallbacksDefined:
      return @1;
    case LogRedirectionStrategyPrintLogsWhenGlobalCallbackNotDefined:
      return @2;
    case LogRedirectionStrategyPrintLogsWhenSessionCallbackNotDefined:
      return @3;
    case LogRedirectionStrategyNeverPrintLogs:
    default:
      return @4;
  }
}

} // namespace

@interface ReactNativeFFmpeg () <SessionDeleteListener>
@end

/**
 * Every protocol method runs on `_methodQueue`, a serial queue of this module's own, so the registries below need
 * no lock. Without it React Native would run this module on the queue all TurboModules share, and the calls that wait
 * for a session's messages would stall every other module. Work that can block for long (executing, shutdown, pipes,
 * streams) goes to a global queue. Session callbacks arrive on FFmpegKit's threads; emitting is thread-safe.
 */
@implementation ReactNativeFFmpeg {
  dispatch_queue_t _methodQueue;
  dispatch_queue_t _asyncQueue;

  std::atomic<bool> _logsEnabled;
  std::atomic<bool> _statisticsEnabled;
  std::atomic<bool> _invalidated;

  // Sessions kept reachable after shutdown, when FFmpegKit's history no longer has them.
  NSMutableDictionary<NSNumber *, id<Session>> *_shutdownSessions;
  BOOL _retainShutdownSessions;

  // ffkit protocol resources, keyed by their url.
  NSMutableDictionary<NSString *, FFmpegKitInputBuffer *> *_inputBuffers;
  NSMutableDictionary<NSString *, FFmpegKitOutputBuffer *> *_outputBuffers;
  NSMutableDictionary<NSString *, FFmpegKitStreamInput *> *_streamInputs;
  NSMutableDictionary<NSString *, FFmpegKitStreamOutput *> *_streamOutputs;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _methodQueue = dispatch_queue_create("com.wekor.reactnativeffmpeg", DISPATCH_QUEUE_SERIAL);
    _asyncQueue = dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0);
    _logsEnabled = false;
    _statisticsEnabled = false;
    _invalidated = false;
    _shutdownSessions = [NSMutableDictionary dictionary];
    _inputBuffers = [NSMutableDictionary dictionary];
    _outputBuffers = [NSMutableDictionary dictionary];
    _streamInputs = [NSMutableDictionary dictionary];
    _streamOutputs = [NSMutableDictionary dictionary];
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return _methodQueue;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  auto module = std::make_shared<facebook::react::NativeReactNativeFFmpegSpecJSI>(params);
  // The JSI module has set the event emitter callback by now; deletions can be reported from here on.
  [FFmpegKitConfig addSessionDeleteListener:self];
  return module;
}

- (void)invalidate
{
  _invalidated = true;
  [FFmpegKitConfig removeSessionDeleteListener:self];

  [_shutdownSessions removeAllObjects];

  // Nobody is left to read or close these. FFmpegKit reference counts them, so a session still using one keeps it.
  for (FFmpegKitInputBuffer *inputBuffer in _inputBuffers.allValues) [inputBuffer close];
  for (FFmpegKitOutputBuffer *outputBuffer in _outputBuffers.allValues) [outputBuffer close];
  for (FFmpegKitStreamInput *streamInput in _streamInputs.allValues) [streamInput close];
  for (FFmpegKitStreamOutput *streamOutput in _streamOutputs.allValues) [streamOutput close];
  [_inputBuffers removeAllObjects];
  [_outputBuffers removeAllObjects];
  [_streamInputs removeAllObjects];
  [_streamOutputs removeAllObjects];
}

#pragma mark - Events

- (void)sendLog:(Log *)log
{
  if (!_logsEnabled || _invalidated) return;
  [self emitOnLog:logDictionary(log)];
}

- (void)sendStatistics:(Statistics *)statistics
{
  if (!_statisticsEnabled || _invalidated) return;
  [self emitOnStatistics:statisticsDictionary(statistics)];
}

- (void)sendComplete:(id<Session>)session
{
  if (_invalidated) return;
  [self emitOnComplete:@{@"sessionId" : @([session getSessionId])}];
}

#pragma mark - SessionDeleteListener

- (void)sessionDeleted:(long)sessionId
{
  if (_invalidated) return;
  [self emitOnSessionDeleted:@{@"sessionId" : @(sessionId)}];
}

#pragma mark - Session lookup

- (AbstractSession *)findSession:(double)sessionId
{
  long sid = (long)sessionId;
  AbstractSession *session = (AbstractSession *)[FFmpegKitConfig getSession:sid];
  if (session != nil) return session;
  return (AbstractSession *)_shutdownSessions[@(sid)];
}

- (void)retainSessionForShutdown:(id<Session>)session
{
  if (_retainShutdownSessions || [FFmpegKitConfig isShutdown]) {
    _shutdownSessions[@([session getSessionId])] = session;
  }
}

#pragma mark - AbstractSession

- (void)abstractSessionGetEndTime:(double)sessionId
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  NSDate *endTime = [session getEndTime];
  resolve(endTime != nil ? millisecondsOf(endTime) : nil);
}

- (void)abstractSessionGetDuration:(double)sessionId
                           resolve:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(@([session getDuration]));
}

- (void)abstractSessionGetAllLogs:(double)sessionId
                      waitTimeout:(NSNumber *)waitTimeout
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(logArray([session getAllLogsWithTimeout:timeoutOrDefault(waitTimeout)]));
}

- (void)abstractSessionGetLogs:(double)sessionId
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(logArray([session getLogs]));
}

- (void)abstractSessionGetAllLogsAsString:(double)sessionId
                              waitTimeout:(NSNumber *)waitTimeout
                                  resolve:(RCTPromiseResolveBlock)resolve
                                   reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve([session getAllLogsAsStringWithTimeout:timeoutOrDefault(waitTimeout)]);
}

- (void)abstractSessionGetState:(double)sessionId
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(sessionStateNumber([session getState]));
}

- (void)abstractSessionGetReturnCode:(double)sessionId
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  ReturnCode *returnCode = [session getReturnCode];
  resolve(returnCode != nil ? @([returnCode getValue]) : nil);
}

- (void)abstractSessionGetFailStackTrace:(double)sessionId
                                 resolve:(RCTPromiseResolveBlock)resolve
                                  reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve([session getFailStackTrace]);
}

- (void)thereAreAsynchronousMessagesInTransmit:(double)sessionId
                                       resolve:(RCTPromiseResolveBlock)resolve
                                        reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(@([session thereAreAsynchronousMessagesInTransmit]));
}

#pragma mark - ArchDetect

- (void)getArch:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([ArchDetect getArch]);
}

#pragma mark - Creating sessions

- (void)ffmpegSession:(NSArray *)commandArguments
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  __weak ReactNativeFFmpeg *weakSelf = self;
  FFmpegSession *session = [FFmpegSession create:commandArguments
      withCompleteCallback:^(FFmpegSession *completedSession) {
        [weakSelf sendComplete:completedSession];
      }
      withLogCallback:^(Log *log) {
        [weakSelf sendLog:log];
      }
      withStatisticsCallback:^(Statistics *statistics) {
        [weakSelf sendStatistics:statistics];
      }
      withLogRedirectionStrategy:LogRedirectionStrategyNeverPrintLogs];
  [self retainSessionForShutdown:session];
  resolve(sessionDictionary(session));
}

- (void)ffmpegSessionGetAllStatistics:(double)sessionId
                          waitTimeout:(NSNumber *)waitTimeout
                              resolve:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFmpeg]) return reject(@"NOT_FFMPEG_SESSION", kWrongSessionType, nil);
  resolve(statisticsArray([(FFmpegSession *)session getAllStatisticsWithTimeout:timeoutOrDefault(waitTimeout)]));
}

- (void)ffmpegSessionGetStatistics:(double)sessionId
                           resolve:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFmpeg]) return reject(@"NOT_FFMPEG_SESSION", kWrongSessionType, nil);
  resolve(statisticsArray([(FFmpegSession *)session getStatistics]));
}

- (void)ffprobeSession:(NSArray *)commandArguments
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  __weak ReactNativeFFmpeg *weakSelf = self;
  FFprobeSession *session = [FFprobeSession create:commandArguments
      withCompleteCallback:^(FFprobeSession *completedSession) {
        [weakSelf sendComplete:completedSession];
      }
      withLogCallback:^(Log *log) {
        [weakSelf sendLog:log];
      }
      withLogRedirectionStrategy:LogRedirectionStrategyNeverPrintLogs];
  [self retainSessionForShutdown:session];
  resolve(sessionDictionary(session));
}

- (void)mediaInformationSession:(NSArray *)commandArguments
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  __weak ReactNativeFFmpeg *weakSelf = self;
  MediaInformationSession *session = [MediaInformationSession create:commandArguments
      withCompleteCallback:^(MediaInformationSession *completedSession) {
        [weakSelf sendComplete:completedSession];
      }
      withLogCallback:^(Log *log) {
        [weakSelf sendLog:log];
      }];
  [self retainSessionForShutdown:session];
  resolve(sessionDictionary(session));
}

- (void)mediaInformationJsonParserFrom:(NSString *)ffprobeJsonOutput
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  @try {
    resolve(mediaInformationDictionary([MediaInformationJsonParser fromWithError:ffprobeJsonOutput]));
  } @catch (NSException *exception) {
    NSLog(@"Parsing MediaInformation failed: %@.", exception.reason);
    resolve(nil);
  }
}

- (void)mediaInformationJsonParserFromWithError:(NSString *)ffprobeJsonOutput
                                        resolve:(RCTPromiseResolveBlock)resolve
                                         reject:(RCTPromiseRejectBlock)reject
{
  @try {
    resolve(mediaInformationDictionary([MediaInformationJsonParser fromWithError:ffprobeJsonOutput]));
  } @catch (NSException *exception) {
    NSLog(@"Parsing MediaInformation failed: %@.", exception.reason);
    reject(@"PARSE_FAILED", @"Parsing MediaInformation failed with JSON error.", nil);
  }
}

#pragma mark - Redirection, logs and statistics

- (void)enableRedirection:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _logsEnabled = true;
  _statisticsEnabled = true;
  [FFmpegKitConfig enableRedirection];
  resolve(nil);
}

- (void)disableRedirection:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig disableRedirection];
  resolve(nil);
}

- (void)enableLogs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _logsEnabled = true;
  resolve(nil);
}

- (void)disableLogs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _logsEnabled = false;
  resolve(nil);
}

- (void)enableStatistics:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _statisticsEnabled = true;
  resolve(nil);
}

- (void)disableStatistics:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _statisticsEnabled = false;
  resolve(nil);
}

#pragma mark - Fonts

- (void)setFontconfigConfigurationPath:(NSString *)path
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setFontconfigConfigurationPath:path];
  resolve(nil);
}

- (void)setFontDirectory:(NSString *)fontDirectoryPath
             fontNameMap:(NSDictionary *_Nullable)fontNameMap
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setFontDirectory:fontDirectoryPath with:fontNameMap];
  resolve(nil);
}

- (void)setFontDirectoryList:(NSArray *)fontDirectoryList
                 fontNameMap:(NSDictionary *_Nullable)fontNameMap
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setFontDirectoryList:fontDirectoryList with:fontNameMap];
  resolve(nil);
}

#pragma mark - Named pipes

- (void)registerNewFFmpegPipe:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  resolve([FFmpegKitConfig registerNewFFmpegPipe]);
#pragma clang diagnostic pop
}

- (void)closeFFmpegPipe:(NSString *)ffmpegPipePath
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  [FFmpegKitConfig closeFFmpegPipe:ffmpegPipePath];
#pragma clang diagnostic pop
  resolve(nil);
}

- (void)writeToPipe:(NSString *)inputPath
      namedPipePath:(NSString *)namedPipePath
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  // Opening a pipe for writing blocks until FFmpeg opens it for reading.
  dispatch_async(_asyncQueue, ^{
    NSLog(@"Starting copy %@ to pipe %@ operation.", inputPath, namedPipePath);

    NSFileHandle *fileHandle = [NSFileHandle fileHandleForReadingAtPath:inputPath];
    if (fileHandle == nil) {
      NSLog(@"Failed to open file %@.", inputPath);
      reject(@"Copy failed", [NSString stringWithFormat:@"Failed to open file %@.", inputPath], nil);
      return;
    }

    NSFileHandle *pipeHandle = [NSFileHandle fileHandleForWritingAtPath:namedPipePath];
    if (pipeHandle == nil) {
      NSLog(@"Failed to open pipe %@.", namedPipePath);
      reject(@"Copy failed", [NSString stringWithFormat:@"Failed to open pipe %@.", namedPipePath], nil);
      [fileHandle closeFile];
      return;
    }

    const NSUInteger bufferSize = 4096;
    unsigned long long totalBytes = 0;
    NSDate *startTime = [NSDate date];

    @try {
      [fileHandle seekToFileOffset:0];
      for (;;) {
        NSData *data = [fileHandle readDataOfLength:bufferSize];
        if (data.length == 0) break;
        totalBytes += data.length;
        [pipeHandle writeData:data];
      }
      NSLog(@"Copying %@ to pipe %@ operation completed successfully. %llu bytes copied in %f seconds.",
            inputPath,
            namedPipePath,
            totalBytes,
            -[startTime timeIntervalSinceNow]);
      resolve(@0);
    } @catch (NSException *exception) {
      NSLog(@"Copy failed %@.", exception.reason);
      reject(@"Copy failed",
             [NSString stringWithFormat:@"Copy %@ to %@ failed with error %@.", inputPath, namedPipePath, exception.reason],
             nil);
    } @finally {
      [fileHandle closeFile];
      [pipeHandle closeFile];
    }
  });
}

#pragma mark - Version, build and environment

- (void)getFFmpegVersion:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([FFmpegKitConfig getFFmpegVersion]);
}

- (void)getBuildDate:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([FFmpegKitConfig getBuildDate]);
}

- (void)setEnvironmentVariable:(NSString *)variableName
                 variableValue:(NSString *)variableValue
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setEnvironmentVariable:variableName value:variableValue];
  resolve(nil);
}

- (void)ignoreSignal:(double)signalValue
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  Signal signal = (Signal)0;
  if (std::isfinite(signalValue) && signalValue == std::trunc(signalValue) && signalValue >= 0 && signalValue <= INT_MAX) {
    signal = (Signal) static_cast<int>(signalValue);
  }
  switch (signal) {
    case SignalInt:
    case SignalQuit:
    case SignalPipe:
    case SignalTerm:
    case SignalXcpu:
      [FFmpegKitConfig ignoreSignal:signal];
      resolve(nil);
      return;
    default:
      reject(@"INVALID_SIGNAL", @"Signal value not supported.", nil);
  }
}

- (void)getPlatform:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(kPlatformName);
}

- (void)getPackageName:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([Packages getPackageName]);
}

- (void)getExternalLibraries:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([Packages getExternalLibraries]);
}

#pragma mark - Executing

- (void)ffmpegSessionExecute:(double)sessionId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFmpeg]) return reject(@"NOT_FFMPEG_SESSION", kWrongSessionType, nil);
  dispatch_async(_asyncQueue, ^{
    [FFmpegKitConfig ffmpegExecute:(FFmpegSession *)session];
    resolve(nil);
  });
}

- (void)ffprobeSessionExecute:(double)sessionId
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFprobe]) return reject(@"NOT_FFPROBE_SESSION", kWrongSessionType, nil);
  dispatch_async(_asyncQueue, ^{
    [FFmpegKitConfig ffprobeExecute:(FFprobeSession *)session];
    resolve(nil);
  });
}

- (void)mediaInformationSessionExecute:(double)sessionId
                           waitTimeout:(NSNumber *)waitTimeout
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isMediaInformation]) return reject(@"NOT_MEDIA_INFORMATION_SESSION", kWrongSessionType, nil);
  int timeout = timeoutOrDefault(waitTimeout);
  dispatch_async(_asyncQueue, ^{
    [FFmpegKitConfig getMediaInformationExecute:(MediaInformationSession *)session withTimeout:timeout];
    resolve(nil);
  });
}

- (void)asyncFFmpegSessionExecute:(double)sessionId
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFmpeg]) return reject(@"NOT_FFMPEG_SESSION", kWrongSessionType, nil);
  [FFmpegKitConfig asyncFFmpegExecute:(FFmpegSession *)session];
  resolve(nil);
}

- (void)asyncFFprobeSessionExecute:(double)sessionId
                           resolve:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isFFprobe]) return reject(@"NOT_FFPROBE_SESSION", kWrongSessionType, nil);
  [FFmpegKitConfig asyncFFprobeExecute:(FFprobeSession *)session];
  resolve(nil);
}

- (void)asyncMediaInformationSessionExecute:(double)sessionId
                                waitTimeout:(NSNumber *)waitTimeout
                                    resolve:(RCTPromiseResolveBlock)resolve
                                     reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isMediaInformation]) return reject(@"NOT_MEDIA_INFORMATION_SESSION", kWrongSessionType, nil);
  [FFmpegKitConfig asyncGetMediaInformationExecute:(MediaInformationSession *)session
                                       withTimeout:timeoutOrDefault(waitTimeout)];
  resolve(nil);
}

- (void)cancel:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKit cancel];
  resolve(nil);
}

- (void)cancelSession:(double)sessionId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKit cancel:(long)sessionId];
  resolve(nil);
}

#pragma mark - Configuration

- (void)getLogLevel:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([FFmpegKitConfig getLogLevel]));
}

- (void)setLogLevel:(double)level resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setLogLevel:static_cast<int>(level)];
  resolve(nil);
}

- (void)getSessionHistorySize:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([FFmpegKitConfig getSessionHistorySize]));
}

- (void)setSessionHistorySize:(double)sessionHistorySize
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [FFmpegKitConfig setSessionHistorySize:static_cast<int>(sessionHistorySize)];
    resolve(nil);
  } @catch (NSException *exception) {
    rejectException(reject, @"INVALID_ARGUMENTS", exception);
  }
}

- (void)getLogRedirectionStrategy:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(logRedirectionStrategyNumber([FFmpegKitConfig getLogRedirectionStrategy]));
}

- (void)setLogRedirectionStrategy:(double)logRedirectionStrategy
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig setLogRedirectionStrategy:(LogRedirectionStrategy) static_cast<int>(logRedirectionStrategy)];
  resolve(nil);
}

- (void)messagesInTransmit:(double)sessionId
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([FFmpegKitConfig messagesInTransmit:(long)sessionId]));
}

- (void)printLoadConfirmation:(NSString *)version
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *packageName = [Packages getPackageName];
    NSString *packageNamePart = packageName.length > 0 ? [NSString stringWithFormat:@"%@-", packageName] : @"";
    NSString *versionPart = version.length > 0 ? version : @"unknown";
    NSLog(@"Loaded react-native-ffmpeg-%@%@-%@-%@.", packageNamePart, kPlatformName, [ArchDetect getArch], versionPart);
  });
  resolve(nil);
}

#pragma mark - Session history

- (void)getSession:(double)sessionId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  id<Session> session = [FFmpegKitConfig getSession:(long)sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  resolve(sessionDictionary(session));
}

- (void)getLastSession:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionDictionary([FFmpegKitConfig getLastSession]));
}

- (void)getLastCompletedSession:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionDictionary([FFmpegKitConfig getLastCompletedSession]));
}

- (void)getSessions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionArray([FFmpegKitConfig getSessions]));
}

- (void)getSessionsByState:(double)sessionState
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionArray([FFmpegKitConfig getSessionsByState:(SessionState) static_cast<int>(sessionState)]));
}

- (void)getFFmpegSessions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionArray([FFmpegKit listSessions]));
}

- (void)getFFprobeSessions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionArray([FFprobeKit listFFprobeSessions]));
}

- (void)getMediaInformationSessions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(sessionArray([FFprobeKit listMediaInformationSessions]));
}

- (void)getMediaInformation:(double)sessionId
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  AbstractSession *session = [self findSession:sessionId];
  if (session == nil) return rejectSessionNotFound(reject);
  if (![session isMediaInformation]) return reject(@"NOT_MEDIA_INFORMATION_SESSION", kWrongSessionType, nil);
  resolve(mediaInformationDictionary([(MediaInformationSession *)session getMediaInformation]));
}

- (void)clearSessions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [FFmpegKitConfig clearSessions];
  [_shutdownSessions removeAllObjects];
  resolve(nil);
}

- (void)deleteSession:(double)sessionId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  long sid = (long)sessionId;
  [FFmpegKitConfig deleteSession:sid];
  [_shutdownSessions removeObjectForKey:@(sid)];
  resolve(nil);
}

#pragma mark - Android only

- (void)selectDocument:(BOOL)writable
                 title:(NSString *_Nullable)title
                  type:(NSString *_Nullable)type
            extraTypes:(NSArray *_Nullable)extraTypes
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  rejectUnsupported(reject);
}

- (void)getSafParameter:(NSString *)uriString
               openMode:(NSString *)openMode
               reusable:(BOOL)reusable
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  rejectUnsupported(reject);
}

- (void)unregisterSafProtocolUrl:(NSString *)safUrl
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  rejectUnsupported(reject);
}

- (void)getSupportedCameraIds:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  rejectUnsupported(reject);
}

#pragma mark - Input buffers

- (void)inputBufferFromByteArray:(NSString *)base64Data
                       extension:(NSString *_Nullable)extension
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  NSData *bytes = base64Data != nil ? [[NSData alloc] initWithBase64EncodedString:base64Data options:0] : nil;
  if (bytes == nil) return reject(@"INVALID_DATA", @"Invalid input buffer data.", nil);
  @try {
    FFmpegKitInputBuffer *inputBuffer = [FFmpegKitInputBuffer fromData:bytes extension:extension];
    NSString *url = [inputBuffer getUrl];
    _inputBuffers[url] = inputBuffer;
    resolve(url);
  } @catch (NSException *exception) {
    rejectException(reject, @"INPUT_BUFFER_CREATE_FAILED", exception);
  }
}

- (void)inputBufferClose:(NSString *)url resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid input buffer url.", nil);
  FFmpegKitInputBuffer *inputBuffer = _inputBuffers[url];
  if (inputBuffer != nil) {
    [inputBuffer close];
    [_inputBuffers removeObjectForKey:url];
  }
  resolve(nil);
}

#pragma mark - Output buffers

- (void)outputBufferCreate:(NSString *_Nullable)extension
           initialCapacity:(NSNumber *)initialCapacity
               maxCapacity:(NSNumber *)maxCapacity
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  @try {
    FFmpegKitOutputBuffer *outputBuffer = initialCapacity != nil && maxCapacity != nil
        ? [FFmpegKitOutputBuffer create:extension
                        initialCapacity:initialCapacity.longValue
                            maxCapacity:maxCapacity.longValue]
        : [FFmpegKitOutputBuffer create:extension];
    NSString *url = [outputBuffer getUrl];
    _outputBuffers[url] = outputBuffer;
    resolve(url);
  } @catch (NSException *exception) {
    rejectException(reject, @"OUTPUT_BUFFER_CREATE_FAILED", exception);
  }
}

- (void)outputBufferGetSize:(NSString *)url resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid output buffer url.", nil);
  FFmpegKitOutputBuffer *outputBuffer = _outputBuffers[url];
  if (outputBuffer == nil) return reject(@"NOT_FOUND", @"Output buffer not found.", nil);
  resolve(@([outputBuffer getSize]));
}

- (void)outputBufferToByteArray:(NSString *)url
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid output buffer url.", nil);
  FFmpegKitOutputBuffer *outputBuffer = _outputBuffers[url];
  if (outputBuffer == nil) return reject(@"NOT_FOUND", @"Output buffer not found.", nil);
  @try {
    resolve([[outputBuffer toData] base64EncodedStringWithOptions:0]);
  } @catch (NSException *exception) {
    rejectException(reject, @"OUTPUT_BUFFER_READ_FAILED", exception);
  }
}

- (void)outputBufferClose:(NSString *)url resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid output buffer url.", nil);
  FFmpegKitOutputBuffer *outputBuffer = _outputBuffers[url];
  if (outputBuffer != nil) {
    [outputBuffer close];
    [_outputBuffers removeObjectForKey:url];
  }
  resolve(nil);
}

#pragma mark - Stream input

- (void)streamInputCreate:(NSString *_Nullable)extension
                 capacity:(NSNumber *)capacity
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  @try {
    FFmpegKitStreamInput *streamInput = capacity != nil
        ? [FFmpegKitStreamInput create:extension capacity:capacity.longValue]
        : [FFmpegKitStreamInput create:extension];
    NSString *url = [streamInput getUrl];
    _streamInputs[url] = streamInput;
    resolve(url);
  } @catch (NSException *exception) {
    rejectException(reject, @"STREAM_INPUT_CREATE_FAILED", exception);
  }
}

- (void)streamInputWrite:(NSString *)url
              base64Data:(NSString *)base64Data
               timeoutMs:(NSNumber *)timeoutMs
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil || base64Data == nil) {
    return reject(@"INVALID_ARGUMENTS", @"Invalid stream input arguments.", nil);
  }
  FFmpegKitStreamInput *streamInput = _streamInputs[url];
  if (streamInput == nil) return reject(@"NOT_FOUND", @"Stream input not found.", nil);
  NSData *bytes = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
  // Writing blocks while the stream is full.
  dispatch_async(_asyncQueue, ^{
    @try {
      int written = timeoutMs != nil ? [streamInput write:bytes timeout:timeoutMs.intValue] : [streamInput write:bytes];
      resolve(@(written));
    } @catch (NSException *exception) {
      rejectException(reject, @"STREAM_INPUT_WRITE_FAILED", exception);
    }
  });
}

- (void)streamInputCloseInput:(NSString *)url
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid stream input url.", nil);
  [_streamInputs[url] closeInput];
  resolve(nil);
}

- (void)streamInputClose:(NSString *)url resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid stream input url.", nil);
  FFmpegKitStreamInput *streamInput = _streamInputs[url];
  if (streamInput != nil) {
    [streamInput close];
    [_streamInputs removeObjectForKey:url];
  }
  resolve(nil);
}

#pragma mark - Stream output

- (void)streamOutputCreate:(NSString *_Nullable)extension
                  capacity:(NSNumber *)capacity
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  @try {
    FFmpegKitStreamOutput *streamOutput = capacity != nil
        ? [FFmpegKitStreamOutput create:extension capacity:capacity.longValue]
        : [FFmpegKitStreamOutput create:extension];
    NSString *url = [streamOutput getUrl];
    _streamOutputs[url] = streamOutput;
    resolve(url);
  } @catch (NSException *exception) {
    rejectException(reject, @"STREAM_OUTPUT_CREATE_FAILED", exception);
  }
}

- (void)streamOutputRead:(NSString *)url
                maxBytes:(double)maxBytes
               timeoutMs:(NSNumber *)timeoutMs
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_ARGUMENTS", @"Invalid stream output arguments.", nil);
  FFmpegKitStreamOutput *streamOutput = _streamOutputs[url];
  if (streamOutput == nil) return reject(@"NOT_FOUND", @"Stream output not found.", nil);
  int count = static_cast<int>(maxBytes);
  // Reading blocks until data arrives, the stream ends or the timeout passes.
  dispatch_async(_asyncQueue, ^{
    @try {
      NSData *data = timeoutMs != nil ? [streamOutput read:count timeout:timeoutMs.intValue] : [streamOutput read:count];
      // An empty string at end of stream.
      resolve(data != nil ? [data base64EncodedStringWithOptions:0] : @"");
    } @catch (NSException *exception) {
      rejectException(reject, @"STREAM_OUTPUT_READ_FAILED", exception);
    }
  });
}

- (void)streamOutputClose:(NSString *)url resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (url == nil) return reject(@"INVALID_URL", @"Invalid stream output url.", nil);
  FFmpegKitStreamOutput *streamOutput = _streamOutputs[url];
  if (streamOutput != nil) {
    [streamOutput close];
    [_streamOutputs removeObjectForKey:url];
  }
  resolve(nil);
}

#pragma mark - Lifecycle

- (void)shutdown:(double)waitTimeout resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  if (!std::isfinite(waitTimeout) || waitTimeout != std::trunc(waitTimeout) || waitTimeout < INT_MIN ||
      waitTimeout > INT_MAX) {
    return reject(@"INVALID_ARGUMENTS", @"waitTimeout must be a signed 32-bit integer in milliseconds.", nil);
  }
  _retainShutdownSessions = YES;
  for (id<Session> session in [FFmpegKitConfig getSessions]) {
    _shutdownSessions[@([session getSessionId])] = session;
  }
  int timeout = static_cast<int>(waitTimeout);
  dispatch_async(_asyncQueue, ^{
    @try {
      resolve(@([FFmpegKitConfig shutdownWithTimeout:timeout]));
    } @catch (NSException *exception) {
      rejectException(reject, @"SHUTDOWN_FAILED", exception);
    }
  });
}

- (void)isShutdown:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([FFmpegKitConfig isShutdown]));
}

- (void)uninit:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_shutdownSessions removeAllObjects];
  resolve(nil);
}

@end

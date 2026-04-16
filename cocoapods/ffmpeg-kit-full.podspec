Pod::Spec.new do |s|
  s.name             = 'ffmpeg-kit-full'
  s.version          = '6.0.0'
  s.summary          = 'FFmpeg Kit iOS Full Shared Framework'
  s.description      = 'Full iOS build of FFmpeg Kit with all default libraries.'
  s.homepage         = 'https://github.com/wekor/ffmpeg'
  s.authors          = { 'ARTHENICA' => 'open-source@arthenica.com' }
  s.license          = { :type => 'LGPL-3.0', :file => 'ffmpegkit.xcframework/ios-arm64/ffmpegkit.framework/LICENSE' }
  s.platform         = :ios, '12.1'
  s.requires_arc     = true

  s.libraries        = 'z', 'bz2', 'c++', 'iconv'

  s.source           = { :http => 'https://github.com/wekor/ffmpeg/releases/download/v6.0.0/ffmpeg-kit-full.zip' }

  s.ios.frameworks   = 'AudioToolbox', 'AVFoundation', 'CoreMedia', 'VideoToolbox'

  s.vendored_frameworks = 'ffmpegkit.xcframework', 'libavcodec.xcframework', 'libavdevice.xcframework', 'libavfilter.xcframework', 'libavformat.xcframework', 'libavutil.xcframework', 'libswresample.xcframework', 'libswscale.xcframework'

end

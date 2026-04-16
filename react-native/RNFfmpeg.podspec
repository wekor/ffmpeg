require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = 'RNFfmpeg'
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platform          = :ios
  s.requires_arc      = true
  s.static_framework  = true

  s.source       = { :git => "https://github.com/wekor/ffmpeg.git", :tag => "v6.0.0" }

  s.default_subspec   = 'https'

  s.dependency "React-Core"

  s.subspec 'https' do |ss|
      ss.source_files      = '**/FFmpegKitReactNativeModule.m',
                             '**/FFmpegKitReactNativeModule.h'
      ss.dependency 'ffmpeg-kit-full', "6.0.0"
      ss.ios.deployment_target = '12.1'
  end

end

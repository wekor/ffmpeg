require "json"
require "digest"
require "fileutils"
require "tmpdir"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ffmpeg_kit = package["ffmpegKit"]

# The FFmpegKit xcframeworks are built by .github/workflows/native.yml and attached to a GitHub release. They are
# fetched here, at `pod install`, into ios/Frameworks (git- and npm-ignored), and fetched again when the release
# in package.json changes.
frameworks_dir = File.join(__dir__, "ios", "Frameworks")
release_marker = File.join(frameworks_dir, ".release")
unless File.exist?(release_marker) && File.read(release_marker).strip == ffmpeg_kit["release"]
  url = "https://github.com/wekor/ffmpeg/releases/download/#{ffmpeg_kit["release"]}/ffmpeg-kit-ios-xcframework.zip"
  Dir.mktmpdir do |tmp|
    zip = File.join(tmp, "ffmpeg-kit.zip")
    Pod::UI.puts "[ReactNativeFFmpeg] Downloading #{url}"
    system("curl", "--fail", "--location", "--silent", "--show-error", "--retry", "3", "--output", zip, url) ||
      raise("[ReactNativeFFmpeg] Could not download #{url}")
    expected = ffmpeg_kit["iosSha256"].to_s
    actual = Digest::SHA256.file(zip).hexdigest
    if !expected.empty? && actual != expected
      raise "[ReactNativeFFmpeg] #{url} has SHA-256 #{actual}, expected #{expected}"
    end
    FileUtils.rm_rf(frameworks_dir)
    FileUtils.mkdir_p(frameworks_dir)
    system("unzip", "-q", zip, "-d", frameworks_dir) || raise("[ReactNativeFFmpeg] Could not unzip #{zip}")
    File.write(release_marker, ffmpeg_kit["release"])
  end
end

Pod::Spec.new do |s|
  s.name         = "ReactNativeFFmpeg"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/wekor/ffmpeg.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"
  s.private_header_files = "ios/**/*.h"
  s.vendored_frameworks = "ios/Frameworks/*.xcframework"
  s.frameworks = "AudioToolbox", "AVFoundation", "CoreMedia", "VideoToolbox"
  s.libraries = "z", "bz2", "c++", "iconv"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES"
  }

  install_modules_dependencies(s)
end

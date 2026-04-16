# Build Script Options

Specify environment variables as `VARIABLE=VALUE` to override default build options.

## General Options

| Option                                  | Description                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `-h, --help`                            | Display help and exit                                                          |
| `-v, --version`                         | Display version and exit                                                       |
| `-d, --debug`                           | Build with debug information                                                   |
| `-s, --speed`                           | Optimize for speed instead of size                                             |
| `-f, --force`                           | Ignore warnings                                                                |
| `-x, --xcframework`                     | Build xcframework bundles instead of framework bundles and universal libraries |
| `-l, --lts`                             | Build LTS packages to support SDK 10+ devices                                  |
| `--target=ios sdk version`              | Override minimum deployment target *(default: 12.1)*                           |
| `--mac-catalyst-target=ios sdk version` | Override minimum deployment target for mac catalyst *(default: 14.0)*          |

---

## Licensing Options

| Option         | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `--enable-gpl` | Allow building GPL libraries; output will be GPLv3 licensed *(default: no)* |

---

## Architectures

| Option                          | Skip Architecture   | Default |
| ------------------------------- | ------------------- | ------- |
| `--disable-armv7`               | armv7               | yes     |
| `--disable-armv7s`              | armv7s              | yes     |
| `--disable-arm64`               | arm64               | yes     |
| `--disable-arm64-mac-catalyst`  | arm64-mac-catalyst  | yes     |
| `--disable-arm64-simulator`     | arm64-simulator     | yes     |
| `--disable-arm64e`              | arm64e              | yes     |
| `--disable-i386`                | i386                | yes     |
| `--disable-x86-64`              | x86_64              | yes     |
| `--disable-x86-64-mac-catalyst` | x86_64-mac-catalyst | yes     |

---

## Libraries

### Non-GPL Libraries

Enable these features individually:

| Option                      | Library                               | Default |
| --------------------------- | ------------------------------------- | ------- |
| `--full`                    | Enable all non-GPL external libraries | —       |
| `--enable-ios-audiotoolbox` | Apple AudioToolbox                    | no      |
| `--enable-ios-avfoundation` | Apple AVFoundation                    | no      |
| `--enable-ios-bzip2`        | bzip2                                 | no      |
| `--enable-ios-videotoolbox` | Apple VideoToolbox                    | no      |
| `--enable-ios-zlib`         | zlib                                  | no      |
| `--enable-ios-libiconv`     | libiconv                              | no      |
| `--enable-chromaprint`      | chromaprint                           | no      |
| `--enable-dav1d`            | dav1d                                 | no      |
| `--enable-fontconfig`       | fontconfig                            | no      |
| `--enable-freetype`         | freetype                              | no      |
| `--enable-fribidi`          | fribidi                               | no      |
| `--enable-gmp`              | gmp                                   | no      |
| `--enable-gnutls`           | gnutls                                | no      |
| `--enable-kvazaar`          | kvazaar                               | no      |
| `--enable-lame`             | lame                                  | no      |
| `--enable-libaom`           | libaom                                | no      |
| `--enable-libass`           | libass                                | no      |
| `--enable-libilbc`          | libilbc                               | no      |
| `--enable-libtheora`        | libtheora                             | no      |
| `--enable-libvorbis`        | libvorbis                             | no      |
| `--enable-libvpx`           | libvpx                                | no      |
| `--enable-libwebp`          | libwebp                               | no      |
| `--enable-libxml2`          | libxml2                               | no      |
| `--enable-opencore-amr`     | opencore-amr                          | no      |
| `--enable-openh264`         | openh264                              | no      |
| `--enable-openssl`          | openssl                               | no      |
| `--enable-opus`             | opus                                  | no      |
| `--enable-sdl`              | SDL                                   | no      |
| `--enable-shine`            | shine                                 | no      |
| `--enable-snappy`           | snappy                                | no      |
| `--enable-soxr`             | soxr                                  | no      |
| `--enable-speex`            | speex                                 | no      |
| `--enable-srt`              | srt                                   | no      |
| `--enable-tesseract`        | tesseract                             | no      |
| `--enable-twolame`          | twolame                               | no      |
| `--enable-vo-amrwbenc`      | vo-amrwbenc                           | no      |
| `--enable-zimg`             | zimg                                  | no      |

---

## GPL Libraries

*(Requires `--enable-gpl`)*

| Option                | Library    | Default |
| --------------------- | ---------- | ------- |
| `--enable-libvidstab` | libvidstab | no      |
| `--enable-rubberband` | rubberband | no      |
| `--enable-x264`       | x264       | no      |
| `--enable-x265`       | x265       | no      |
| `--enable-xvidcore`   | xvidcore   | no      |

---

## Custom Libraries

You may define custom libraries with numbered patterns:

```
--enable-custom-library-[n]-name=value
--enable-custom-library-[n]-repo=value
--enable-custom-library-[n]-repo-commit=value
--enable-custom-library-[n]-repo-tag=value
--enable-custom-library-[n]-package-config-file-name=value
--enable-custom-library-[n]-ffmpeg-enable-flag=value
--enable-custom-library-[n]-license-file=value
```

---

## Advanced Options

| Option                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `--reconf-LIBRARY`     | Run `autoreconf` before building LIBRARY *(default: no)*      |
| `--redownload-LIBRARY` | Force re-download even if already cached *(default: no)*      |
| `--rebuild-LIBRARY`    | Force rebuild even if already built *(default: no)*           |
| `--no-framework`       | Do not build framework bundles/universal libs *(default: no)* |
| `--no-bitcode`         | Do not enable bitcode *(default: no)*                         |
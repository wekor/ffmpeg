# Android Build Script Options

Specify environment variables as `VARIABLE=VALUE` to override default build options.

---

## 📌 General Options

| Option                      | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `-h, --help`                | Display help and exit                             |
| `-v, --version`             | Display version and exit                          |
| `-d, --debug`               | Build with debug information                      |
| `-s, --speed`               | Optimize for speed instead of size                |
| `-f, --force`               | Ignore warnings                                   |
| `-l, --lts`                 | Build LTS packages supporting **API 16+** devices |
| `--api-level=api`           | Override Android API level                        |
| `--no-ffmpeg-kit-protocols` | Disable FFmpeg-kit custom protocols (saf)         |

---

## 📄 Licensing Options

| Option         | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| `--enable-gpl` | Enable GPL libraries; generated libraries will be GPLv3 licensed *(default: no)* |

---

## 🧱 Architectures

| Option                   | Architecture | Default |
| ------------------------ | ------------ | ------- |
| `--disable-arm-v7a`      | arm-v7a      | yes     |
| `--disable-arm-v7a-neon` | arm-v7a-neon | yes     |
| `--disable-arm64-v8a`    | arm64-v8a    | yes     |
| `--disable-x86`          | x86          | yes     |
| `--disable-x86-64`       | x86_64       | yes     |

---

## 📚 Libraries

### 👉 Non-GPL Libraries

| Option                         | Library                       | Default |
| ------------------------------ | ----------------------------- | ------- |
| `--full`                       | Enable all external libraries | —       |
| `--enable-android-media-codec` | Android MediaCodec            | no      |
| `--enable-android-zlib`        | Android zlib                  | no      |
| `--enable-chromaprint`         | chromaprint                   | no      |
| `--enable-dav1d`               | dav1d                         | no      |
| `--enable-fontconfig`          | fontconfig                    | no      |
| `--enable-freetype`            | freetype                      | no      |
| `--enable-fribidi`             | fribidi                       | no      |
| `--enable-gmp`                 | gmp                           | no      |
| `--enable-gnutls`              | gnutls                        | no      |
| `--enable-kvazaar`             | kvazaar                       | no      |
| `--enable-lame`                | lame                          | no      |
| `--enable-libaom`              | libaom                        | no      |
| `--enable-libass`              | libass                        | no      |
| `--enable-libiconv`            | libiconv                      | no      |
| `--enable-libilbc`             | libilbc                       | no      |
| `--enable-libtheora`           | libtheora                     | no      |
| `--enable-libvorbis`           | libvorbis                     | no      |
| `--enable-libvpx`              | libvpx                        | no      |
| `--enable-libwebp`             | libwebp                       | no      |
| `--enable-libxml2`             | libxml2                       | no      |
| `--enable-opencore-amr`        | opencore-amr                  | no      |
| `--enable-openh264`            | openh264                      | no      |
| `--enable-openssl`             | openssl                       | no      |
| `--enable-opus`                | opus                          | no      |
| `--enable-sdl`                 | SDL                           | no      |
| `--enable-shine`               | shine                         | no      |
| `--enable-snappy`              | snappy                        | no      |
| `--enable-soxr`                | soxr                          | no      |
| `--enable-speex`               | speex                         | no      |
| `--enable-srt`                 | srt                           | no      |
| `--enable-tesseract`           | tesseract                     | no      |
| `--enable-twolame`             | twolame                       | no      |
| `--enable-vo-amrwbenc`         | vo-amrwbenc                   | no      |
| `--enable-zimg`                | zimg                          | no      |

---

## 🛑 GPL Libraries

*(Require `--enable-gpl`)*

| Option                | Library    | Default |
| --------------------- | ---------- | ------- |
| `--enable-libvidstab` | libvidstab | no      |
| `--enable-rubberband` | rubberband | no      |
| `--enable-x264`       | x264       | no      |
| `--enable-x265`       | x265       | no      |
| `--enable-xvidcore`   | xvidcore   | no      |

---

## 🧩 Custom Libraries

```
--enable-custom-library-[n]-name=value
--enable-custom-library-[n]-repo=value
--enable-custom-library-[n]-repo-commit=value
--enable-custom-library-[n]-repo-tag=value
--enable-custom-library-[n]-package-config-file-name=value
--enable-custom-library-[n]-ffmpeg-enable-flag=value
--enable-custom-library-[n]-license-file=value
--enable-custom-library-[n]-uses-cpp
```

用途：添加自定义第三方库（支持 git repo、tag/commit、pkg-config、启用 flag、license 配置等）

---

## ⚙️ Advanced Options

| Option                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `--reconf-LIBRARY`     | Run `autoreconf` before building the library *(default: no)* |
| `--redownload-LIBRARY` | Re-download library even if cached *(default: no)*           |
| `--rebuild-LIBRARY`    | Rebuild library even if already built *(default: no)*        |
| `--no-archive`         | Do not build Android archive *(default: no)*                 |

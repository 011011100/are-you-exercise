# 练了吗

一个给小米 / Android 手机使用的离线锻炼记录 PWA。它可以记录每天是否训练，以及训练了哪些部位：手臂、胸、肩膀、腿、腹部、背。

## 使用方式

直接打开 `index.html` 即可预览和记录，数据会保存在当前浏览器的本机存储里。

如果想像手机软件一样放到桌面：

1. 把整个目录部署到 HTTPS 网站，或在电脑局域网里用本地静态服务器打开。
2. 用小米手机浏览器或 Chrome 打开页面。
3. 在浏览器菜单里选择“添加到桌面”或“安装应用”。

## 功能

- 按日期记录“已训练 / 未训练”
- 选择训练部位：手臂、胸、肩膀、腿、腹部、背
- 支持备注
- 最近 21 天日历视图
- 最近记录列表
- 连续训练、近 7 天、本月、常练部位统计
- JSON 备份导出
- 离线缓存，部署后可离线打开

## APK 打包

仓库内置了 Android WebView 工程，路径是 `android/`。APK 会把网页资源打进安装包，安装后不需要联网。

本机已安装 Java、Gradle 和 Android SDK 时，可以运行：

```bash
cd android
gradle :app:assembleRelease
```

打包产物位置：

```text
android/app/build/outputs/apk/release/app-release.apk
```

也可以直接在 GitHub Actions 里运行 `Build APK` 工作流，完成后下载 `are-you-exercise-release-apk` artifact。

每次推送到 `main` 后，工作流也会把最新 release APK 写回仓库：

```text
dist/are-you-exercise-release.apk
```

Release APK 使用固定签名文件 `android/app/release.keystore`。第一次 GitHub Actions 构建时会自动生成并提交这个 keystore，之后更新 APK 时包名和签名都会保持一致，手机覆盖安装时本地锻炼记录可以保留。

如果你已经安装过旧的 debug APK，第一次切换到 release APK 时签名不一致，可能无法直接覆盖安装。建议先在旧版 App 里导出 JSON 备份，再卸载旧版并安装 release APK；之后再更新 release APK 就可以覆盖安装并保留数据。

## 数据说明

所有记录只保存在手机浏览器本地，不会上传到服务器。更换浏览器、清理浏览器数据或卸载 PWA 可能会删除记录，建议定期用导出按钮备份。

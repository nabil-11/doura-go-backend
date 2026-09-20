# Downloads

`doura-go-driver.apk` is served from here, straight off the CDN, and offered at
`/{lang}/driver-app`.

The file is committed on purpose: Vercel builds from the repository, and a
serverless function cannot read `public/` at runtime. It is replaced in place by
each new build, so the download URL never changes.

To publish a new build, from the driver app repository:

```bash
VITE_API_URL=https://doura-go.vercel.app/api/v1 npm run build
npx cap sync android
cd android && ./gradlew assembleDebug        # or assembleRelease, once signed
```

then copy `android/app/build/outputs/apk/debug/app-debug.apk` here as
`doura-go-driver.apk`, bump `DRIVER_APP_VERSION` in `lib/config/driver-app.ts`,
and deploy.

Every build adds its own copy to git history, so move to GitHub Releases or
object storage once releases become frequent.

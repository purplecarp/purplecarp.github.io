# iztro 2.6.5

Vendored browser UMD distribution from https://unpkg.com/iztro@2.6.5/dist/iztro.min.js.
Upstream: https://github.com/SylarLong/iztro (MIT; see LICENSE).
API documentation: https://docs.iztro.com/posts/astrolabe.

The bundle runs locally without a CDN request and includes its calendar dependencies.
Keep the upstream license and bundled third-party notices alongside the distribution.
The application uses `bySolar`, `byLunar`, `horoscope` and `toJSON` with Traditional Chinese output.
Run the integration fixtures with `node --test tests/ziwei.test.cjs` before upgrading.

The reference image's sample is 1999-07-02, male, Si hour; the flow-date fixture is 2026-11-15.
Brightness tables and secondary stars can differ by school; the application uses the upstream defaults.

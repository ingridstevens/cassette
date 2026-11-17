# Dependency vetting

How each outside file was checked before it went into Cassette.

## Fonts (added 2026-11-17)

| | Inter | Vazirmatn |
|---|---|---|
| Upstream | https://github.com/rsms/inter | https://github.com/rastikerdar/vazirmatn |
| How upstream says to get it | Release download; its README also links the npm package `inter-ui` | `npm install vazirmatn` |
| Version used | Inter 4.1 (release `v4.1`; npm `inter-ui` 4.1.1) | 33.003 (release `v33.003`; npm `vazirmatn` 33.0.3) |
| Files in the app | `Inter-Regular`, `-Medium`, `-SemiBold`, `-Bold` (`.woff2`) | `Vazirmatn-Variable.woff2` (from `Vazirmatn[wght].woff2`) |
| Licence | SIL Open Font Licence 1.1 (`app/src/assets/fonts/OFL-Inter.txt`) | SIL Open Font Licence 1.1 (`OFL-Vazirmatn.txt`) |
| Reserved Font Name | None declared in the copyright line. Files are used unmodified and unsubset, so the RFN condition does not apply either way | None declared |

Every file was compared byte for byte (SHA-256) with the file in the upstream GitHub release, not only with the npm copy:

```
Inter-Regular.woff2   e06f6b1bc553aaea4e4668023ed0ab0a147129c3107f511bc7d03d361b0ae085
Inter-Medium.woff2    0ff3e94614e1493eb556314fd247ae6c4a85a7783b4cc86be539940cf83f2a48
Inter-SemiBold.woff2  5cb7103e4e605989afebc03d989c79201e54b21b5183db33981f70db9178a301
Inter-Bold.woff2      fa888127b6da015b65569f0351f3b5c391ad928904951f1c20e9f8462a8d95ea
Vazirmatn[wght].woff2 4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92
```

The npm packages were only downloaded to a scratch folder to compare; they are not dependencies of the app. The font files are plain local files loaded by `app/src/styles/fonts.css`; the app never fetches a font. `app/scripts/check-built-app.mjs` fails if the built output names any remote font or CDN address.

## A note on the npm package

The Inter package on npm (`inter-ui`) is published by a third party (it links the same project, but the repository is not `rsms/inter`). That is why the files came from the official release and only matched against it.

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

    <!-- PWA / Home screen fullscreen -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="BeatFinder" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#0a0a0a" />

    <!-- App icon for home screen -->
    <link rel="apple-touch-icon" href="https://i.ibb.co/v4wcZVJW/IMG-9119.jpg" />
    <link rel="apple-touch-icon" sizes="152x152" href="https://i.ibb.co/v4wcZVJW/IMG-9119.jpg" />
    <link rel="apple-touch-icon" sizes="167x167" href="https://i.ibb.co/v4wcZVJW/IMG-9119.jpg" />
    <link rel="apple-touch-icon" sizes="180x180" href="https://i.ibb.co/v4wcZVJW/IMG-9119.jpg" />

    <!-- Manifest -->
    <link rel="manifest" href="/manifest.json" />

    <title>BeatFinder</title>

    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      /* Hide scrollbar on every element, every browser */
      *,
      *::before,
      *::after {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      *::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }

      /* ── iOS bounce / rubber-band fix ── */
      /* Lock the page itself — no scrolling, no bounce at document level */
      html {
        position: fixed;
        width: 100%;
        height: 100%;
        overflow: hidden;
        overscroll-behavior: none;
        -webkit-overflow-scrolling: auto;
        touch-action: manipulation;
      }

      body {
        position: fixed;
        width: 100%;
        height: 100%;
        overflow: hidden;
        overscroll-behavior: none;
        background: #0a0a0a;
        -webkit-overflow-scrolling: auto;
        touch-action: manipulation;
      }

      #root {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        overscroll-behavior: none;
        background: #0a0a0a;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

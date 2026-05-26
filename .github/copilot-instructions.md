Project: Nông Trại KHTN classroom management UI.

Stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- clsx + tailwind-merge for class composition
- html2canvas for PNG export
- qrcode.react for static QR codes

Routes:
- /ta for the mobile-first assistant screen
- /admin for the dashboard and report modal

Design rules:
- Use only flat dark zinc surfaces, no gradients, no decorative shadows
- Base background: bg-zinc-950
- Surface: bg-zinc-900
- Border: border-zinc-800
- Primary action: bg-blue-600 hover:bg-blue-700 text-white
- Semantic states are solid, not gradient-based

Implementation notes:
- Keep components small and reusable
- Prefer mobile-first layouts and minimum touch targets of 44px
- Keep mock data local unless the user explicitly asks for API work
- Maintain the report template as a portrait PNG-friendly layout
import './globals.css'

export const metadata = {
  title: '2-dars Auth',
  description: 'Next.js + Tailwind + Express authentication',
}

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  )
}

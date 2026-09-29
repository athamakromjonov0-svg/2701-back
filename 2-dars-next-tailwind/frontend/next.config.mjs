import path from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname ESM'da yo'q — import.meta dan hosil qilamiz
const dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  skipTrailingSlashRedirect: true,
  // Node monorepo root'ini aniq belgilaymiz — aks holda Next.js bir nechta
  // package-lock.json'ni ko'rib workspace root'ini noto'g'ri topadi va ogohlantiradi
  outputFileTracingRoot: dirname,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5432/:path*',
      },
      {
        source: '/api-docs',
        destination: 'http://localhost:5432/api-docs',
      },
      {
        source: '/api-docs/:path*',
        destination: 'http://localhost:5432/api-docs/:path*',
      },
    ]
  },
}

export default nextConfig

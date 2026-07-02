/** This repo always uses trailingSlash in next.config.js. */
export function formatRouterPath(internalPath: string): string {
  const qIndex = internalPath.indexOf('?')
  const pathname = qIndex >= 0 ? internalPath.slice(0, qIndex) : internalPath
  const search = qIndex >= 0 ? internalPath.slice(qIndex) : ''
  const normalizedPath = pathname === '/' ? '/' : pathname.endsWith('/') ? pathname : `${pathname}/`
  return `${normalizedPath}${search}`
}

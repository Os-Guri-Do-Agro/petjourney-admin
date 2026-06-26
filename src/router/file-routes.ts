import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

type PageModule = {
  default: Component
}

const pages = import.meta.glob<PageModule>([
  '../pages/**/*.vue',
  '!../pages/(accounts)/tutor/**/*.vue',
])
const disabledRoutePaths = new Set(['/tutor'])

const routeSegmentPatterns = [
  [/^\[\.\.\.(.+)\]$/, ':$1(.*)*'],
  [/^\[(.+)\]$/, ':$1'],
] as const

function isRouteGroupSegment(segment: string) {
  return /^\(.+\)$/.test(segment)
}

function normalizeSegment(segment: string) {
  for (const [pattern, replacement] of routeSegmentPatterns) {
    if (pattern.test(segment)) {
      return segment.replace(pattern, replacement)
    }
  }

  return segment
}

function filePathToRoutePath(filePath: string) {
  const path = filePath
    .replace('../pages/', '')
    .replace(/\.vue$/, '')
    .split('/')
    .filter((segment) => segment !== 'index' && !isRouteGroupSegment(segment))
    .map(normalizeSegment)
    .join('/')

  return path ? `/${path}` : '/'
}

function filePathToRouteName(filePath: string) {
  const routePath = filePathToRoutePath(filePath)

  if (routePath === '/') {
    return 'home'
  }

  return routePath
    .replace(/^\//, '')
    .replace(/[:().*]+/g, '')
    .replace(/\//g, '-')
}

function routePriority(route: RouteRecordRaw) {
  if (route.path.includes('(.*)*')) {
    return 2
  }

  if (route.path.includes(':')) {
    return 1
  }

  return 0
}

export const routes: RouteRecordRaw[] = Object.entries(pages)
  .map(([filePath, component]) => ({
    path: filePathToRoutePath(filePath),
    name: filePathToRouteName(filePath),
    component,
  }))
  .filter((route) => !disabledRoutePaths.has(route.path))
  .sort((currentRoute, nextRoute) => routePriority(currentRoute) - routePriority(nextRoute))

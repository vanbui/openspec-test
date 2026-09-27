import type { LucideIcon } from 'lucide-react';
import {
  ActivityIcon,
  BellIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FilePlus2Icon,
  FileTextIcon,
  InboxIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ServerIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Table2Icon,
} from 'lucide-react';

import type { Capability } from '@/lib/capabilities/capability-adapter';

/**
 * Labelled navigation groups, in render order, after the ungrouped primary items. Each mirrors a
 * catalogue menu path (`Reports:*`, `Administration:*`) and renders only when it holds a visible item.
 */
export const navigationGroups = ['Reports', 'Administration'] as const;
export type NavigationGroup = (typeof navigationGroups)[number];

export interface NavigationItem { href:string; label:string; capability:Capability; icon:LucideIcon; group?: NavigationGroup; }

const workspaceHref = '/app';

/**
 * The one item to mark current: the item whose href is the longest match of the pathname at a path
 * segment boundary, so `/app/requests/new` is New request alone and `/app/review/requests/{id}` is
 * Assessment Requests alone. Workspace (`/app`) matches only itself, so a route no item lists marks
 * nothing current. Pass the items the viewer can see.
 */
export function activeNavigationHref(pathname: string, items: readonly Pick<NavigationItem, 'href'>[]): string | null {
  let active: string | null = null;

  for (const { href } of items) {
    const matches = href === workspaceHref
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    if (matches && (active === null || href.length > active.length)) active = href;
  }

  return active;
}

export const navigation: readonly NavigationItem[] = [
  { href:'/app', label:'Workspace', capability:'assessment-request:read', icon:LayoutDashboardIcon },
  { href:'/app/requests', label:'My Requests', capability:'assessment-request:read', icon:FileTextIcon },
  { href:'/app/questionnaires', label:'My Questionnaires', capability:'assessment-request:read', icon:ClipboardListIcon },
  { href:'/app/assessments', label:'My Risk Assessments', capability:'assessment-request:read', icon:ShieldCheckIcon },
  { href:'/app/requests/new', label:'New request', capability:'assessment-request:create', icon:FilePlus2Icon },
  // The parent of the three review queues. ActivityIcon, because LayoutDashboardIcon already marks Workspace.
  { href:'/app/review', label:'Analyst dashboard', capability:'assessment:review', icon:ActivityIcon },
  { href:'/app/review/requests', label:'Assessment Requests', capability:'assessment:review', icon:InboxIcon },
  { href:'/app/review/questionnaires', label:'Questionnaires', capability:'assessment:review', icon:ClipboardCheckIcon },
  { href:'/app/review/assessments', label:'Risk Assessments', capability:'assessment:review', icon:ShieldAlertIcon },
  { href:'/app/risks', label:'Risk register', capability:'risk:manage', icon:Table2Icon },
  { href:'/app/alerts', label:'Alerts', capability:'assessment:review', icon:BellIcon, group:'Reports' },
  { href:'/app/reports', label:'Reports', capability:'assessment:review', icon:FileChartColumnIcon, group:'Reports' },
  { href:'/app/admin/risk-types', label:'Risk Types', capability:'administration:manage', icon:LayersIcon, group:'Administration' },
  { href:'/app/admin/controls', label:'Controls', capability:'administration:manage', icon:SlidersHorizontalIcon, group:'Administration' },
  { href:'/app/admin/information-systems', label:'Information Systems', capability:'administration:manage', icon:ServerIcon, group:'Administration' },
  { href:'/app/admin/information-assets', label:'Information Assets', capability:'administration:manage', icon:DatabaseIcon, group:'Administration' },
];

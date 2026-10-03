import type { LucideIcon } from 'lucide-react';
import {
  BellIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FilePlus2Icon,
  FileTextIcon,
  HouseIcon,
  InboxIcon,
  LayersIcon,
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

const homeHref = '/app';

/**
 * The one item to mark current: the item whose href is the longest match of the pathname at a path
 * segment boundary, so `/app/requests/new` is New request alone and `/app/review/requests/{id}` is
 * Assessment Requests alone. Home (`/app`) matches only itself, so a route no item lists marks
 * nothing current. Pass the items the viewer can see.
 */
export function activeNavigationHref(pathname: string, items: readonly Pick<NavigationItem, 'href'>[]): string | null {
  let active: string | null = null;

  for (const { href } of items) {
    const matches = href === homeHref
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    if (matches && (active === null || href.length > active.length)) active = href;
  }

  return active;
}

export const navigation: readonly NavigationItem[] = [
  // Home for every actor (D-16): the analyst's review summary or the Requestor's own work.
  { href:'/app', label:'Home', capability:'assessment-request:read', icon:HouseIcon },
  { href:'/app/requests', label:'My Requests', capability:'assessment-request:read', icon:FileTextIcon },
  { href:'/app/questionnaires', label:'My Questionnaires', capability:'assessment-request:read', icon:ClipboardListIcon },
  { href:'/app/assessments', label:'My Risk Assessments', capability:'assessment-request:read', icon:ShieldCheckIcon },
  { href:'/app/requests/new', label:'New request', capability:'assessment-request:create', icon:FilePlus2Icon },
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

import type { LucideIcon } from 'lucide-react';
import {
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
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

export interface NavigationItem { href:string; label:string; capability:Capability; icon:LucideIcon; group?: 'Administration'; }
export const navigation: readonly NavigationItem[] = [
  { href:'/app', label:'Workspace', capability:'assessment-request:read', icon:LayoutDashboardIcon },
  { href:'/app/requests', label:'My Requests', capability:'assessment-request:read', icon:FileTextIcon },
  { href:'/app/questionnaires', label:'My Questionnaires', capability:'assessment-request:read', icon:ClipboardListIcon },
  { href:'/app/assessments', label:'My Risk Assessments', capability:'assessment-request:read', icon:ShieldCheckIcon },
  { href:'/app/requests/new', label:'New request', capability:'assessment-request:create', icon:FilePlus2Icon },
  { href:'/app/review/requests', label:'Assessment Requests', capability:'assessment:review', icon:InboxIcon },
  { href:'/app/review/questionnaires', label:'Questionnaires', capability:'assessment:review', icon:ClipboardCheckIcon },
  { href:'/app/review/assessments', label:'Risk Assessments', capability:'assessment:review', icon:ShieldAlertIcon },
  { href:'/app/risks', label:'Risk register', capability:'risk:manage', icon:Table2Icon },
  { href:'/app/admin/risk-types', label:'Risk Types', capability:'administration:manage', icon:LayersIcon, group:'Administration' },
  { href:'/app/admin/controls', label:'Controls', capability:'administration:manage', icon:SlidersHorizontalIcon, group:'Administration' },
  { href:'/app/admin/information-systems', label:'Information Systems', capability:'administration:manage', icon:ServerIcon, group:'Administration' },
  { href:'/app/admin/information-assets', label:'Information Assets', capability:'administration:manage', icon:DatabaseIcon, group:'Administration' },
];

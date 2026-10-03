import { HomePageHeader } from '@/features/home/home-page-header';

/*
 * Home's route boundary (UI-D4). It renders before the page has read the session, so it cannot know
 * which Home is coming: the header shows without an action and with no body. The page then streams
 * the chosen Home behind that Home's own skeleton.
 */
export default function HomeLoading() {
  return <HomePageHeader withAction={false} />;
}

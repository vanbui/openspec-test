"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { setDevelopmentIdentity } from "./resolve-identity";

/** Server Action boundary for the development-only fixture selector. */
export async function selectDevelopmentIdentity(fixtureKey: unknown): Promise<void> {
  const cookieStore = await cookies();

  setDevelopmentIdentity({ fixtureKey, cookieStore });
  revalidatePath("/", "layout");
}

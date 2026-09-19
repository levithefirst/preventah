/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as catalog from "../catalog.js";
import type * as checkins from "../checkins.js";
import type * as crons from "../crons.js";
import type * as households from "../households.js";
import type * as http from "../http.js";
import type * as mail from "../mail.js";
import type * as members from "../members.js";
import type * as siteAssets from "../siteAssets.js";
import type * as sources from "../sources.js";
import type * as lib_conditionCatalog from "../lib/conditionCatalog.js";
import type * as lib_conditionIndex from "../lib/conditionIndex.js";
import type * as lib_conditionTypes from "../lib/conditionTypes.js";
import type * as lib_conditions from "../lib/conditions.js";
import type * as lib_day from "../lib/day.js";
import type * as lib_joincode from "../lib/joincode.js";
import type * as lib_planContent from "../lib/planContent.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_tiers from "../lib/tiers.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  catalog: typeof catalog;
  checkins: typeof checkins;
  crons: typeof crons;
  households: typeof households;
  http: typeof http;
  mail: typeof mail;
  members: typeof members;
  siteAssets: typeof siteAssets;
  sources: typeof sources;
  "lib/conditionCatalog": typeof lib_conditionCatalog;
  "lib/conditionIndex": typeof lib_conditionIndex;
  "lib/conditionTypes": typeof lib_conditionTypes;
  "lib/conditions": typeof lib_conditions;
  "lib/day": typeof lib_day;
  "lib/joincode": typeof lib_joincode;
  "lib/planContent": typeof lib_planContent;
  "lib/plans": typeof lib_plans;
  "lib/tiers": typeof lib_tiers;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

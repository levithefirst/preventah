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
import type * as lib_condition_catalog from "../lib/condition-catalog.js";
import type * as lib_condition_index from "../lib/condition-index.js";
import type * as lib_condition_types from "../lib/condition-types.js";
import type * as lib_conditions from "../lib/conditions.js";
import type * as lib_day from "../lib/day.js";
import type * as lib_joincode from "../lib/joincode.js";
import type * as lib_plan_content from "../lib/plan-content.js";
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
  "lib/condition-catalog": typeof lib_condition_catalog;
  "lib/condition-index": typeof lib_condition_index;
  "lib/condition-types": typeof lib_condition_types;
  "lib/conditions": typeof lib_conditions;
  "lib/day": typeof lib_day;
  "lib/joincode": typeof lib_joincode;
  "lib/plan-content": typeof lib_plan_content;
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

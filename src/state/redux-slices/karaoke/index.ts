export * from "./slice";
import { _karaokeReducerActions } from "./slice";
import { karaokeThunks } from "./thunks";

export const karaokeActions = { ..._karaokeReducerActions, ...karaokeThunks };

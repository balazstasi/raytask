import { Effect } from "effect";
import * as RaycastApi from "@raycast/api";
import { describe, expect, it, vi } from "vitest";
import {
  LAST_TASK_LIST_ID_KEY,
  getRememberedTaskListId,
  getRememberedTaskListIdEffect,
  rememberTaskListId,
  rememberTaskListIdEffect,
} from "../../src/utils/storage";

describe("storage helpers", () => {
  it("stores and retrieves the remembered task list id", async () => {
    await expect(rememberTaskListId("list-123")).resolves.toBeUndefined();
    await expect(getRememberedTaskListId()).resolves.toBe("list-123");
  });

  it("effect helpers swallow LocalStorage write and read failures", async () => {
    const setItemSpy = vi
      .spyOn(RaycastApi.LocalStorage, "setItem")
      .mockRejectedValueOnce(new Error("write failed"));
    const getItemSpy = vi
      .spyOn(RaycastApi.LocalStorage, "getItem")
      .mockRejectedValueOnce(new Error("read failed"));

    await expect(
      Effect.runPromise(rememberTaskListIdEffect("list-456")),
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(getRememberedTaskListIdEffect()),
    ).resolves.toBeUndefined();

    expect(setItemSpy).toHaveBeenCalledWith(LAST_TASK_LIST_ID_KEY, "list-456");
    expect(getItemSpy).toHaveBeenCalledWith(LAST_TASK_LIST_ID_KEY);
  });
});

import * as React from "react";

const subscribeNever = () => () => {};

export function useMounted() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

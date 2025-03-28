export const safeAwait = async <T>(
  promise: Promise<T>
): Promise<[Error, null] | [null, T]> => {
  try {
    const data = await promise;
    return [null, data];
  } catch (err) {
    return [err as Error, null];
  }
}
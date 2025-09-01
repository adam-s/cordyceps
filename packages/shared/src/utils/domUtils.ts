export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100,
): Promise<boolean> {
  const endTime = Date.now() + timeout;
  return new Promise(resolve => {
    function check() {
      if (condition()) {
        resolve(true);
      } else if (Date.now() < endTime) {
        setTimeout(check, interval);
      } else {
        resolve(false);
      }
    }
    check();
  });
}

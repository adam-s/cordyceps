export class IPC {
  constructor() {
    setTimeout(() => {
      console.log('IPC class constructor called');
    }, 1000);
  }
}
console.log('IPC class loaded');

declare module "@playwright/test" {
  export interface Page {
    goto(url: string, options?: any): Promise<any>;
    locator(selector: string, options?: any): any;
    waitForURL(urlOrPredicate: string | RegExp | ((url: URL) => boolean), options?: any): Promise<any>;
    waitForSelector(selector: string, options?: any): Promise<any>;
    waitForTimeout(timeout: number): Promise<void>;
    screenshot(options?: any): Promise<Buffer>;
    evaluate<R = any>(pageFunction: any, arg?: any): Promise<R>;
    [key: string]: any;
  }

  export interface TestArgs {
    page: Page;
    context: any;
    request: any;
    [key: string]: any;
  }
  export type TestFunction = (args: TestArgs) => Promise<any> | any;
  export interface TestType {
    (name: string, fn: TestFunction): void;
    beforeEach(fn: TestFunction): void;
    describe(name: string, fn: () => void): void;
    [key: string]: any;
  }
  export const test: TestType;
  export const expect: any;
}

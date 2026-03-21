declare module "bullmq" {
  export type Job<T = any> = {
    id?: string | number;
    name?: string;
    data: T;
    attemptsMade: number;
    opts?: {
      attempts?: number;
      [key: string]: any;
    };
  };

  export class Worker<T = any> {
    constructor(name: string, processor: (job: Job<T>) => Promise<any> | any, opts?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    close(): Promise<void>;
  }

  export class Queue<T = any> {
    constructor(name: string, opts?: any);
    add(name: string, data: T, opts?: any): Promise<any>;
  }
}

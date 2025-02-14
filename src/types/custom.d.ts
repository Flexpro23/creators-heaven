declare module 'debug' {
  function debug(namespace: string): debug.Debugger;
  namespace debug {
    interface Debugger {
      (formatter: any, ...args: any[]): void;
      enabled: boolean;
      namespace: string;
    }
  }
  export = debug;
}

declare module 'estree' {
  export interface Node {
    type: string;
  }
}

declare module 'estree-jsx' {
  export * from 'estree';
}

declare module 'hast' {
  export interface Node {
    type: string;
    children?: Node[];
  }
}

declare module 'mdast' {
  export interface Node {
    type: string;
    children?: Node[];
  }
}

// Add any other missing type declarations here if needed 
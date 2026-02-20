declare module 'ldapjs-client' {
  interface LdapClientOptions {
    url: string
    timeout?: number
    tlsOptions?: object
  }

  interface SearchOptions {
    filter?: string
    scope?: 'base' | 'one' | 'sub'
    attributes?: string[]
    sizeLimit?: number
    pageSize?: number
    timeLimit?: number
    typesOnly?: boolean
  }

  interface ModifyChange {
    operation: 'add' | 'delete' | 'replace'
    modification: Record<string, string | string[]>
  }

  class LdapClient {
    constructor(options: LdapClientOptions)
    bind(dn: string, password: string): Promise<void>
    unbind(): Promise<void>
    add(dn: string, entry: Record<string, string | string[] | number>): Promise<void>
    modify(dn: string, change: ModifyChange): Promise<void>
    del(dn: string): Promise<void>
    search(base: string, options: SearchOptions): Promise<Record<string, unknown>[]>
    destroy(): Promise<void>
  }

  export default LdapClient
}

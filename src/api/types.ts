export interface OpenProjectConfig {
  url: string;
  apiKey: string;
}

export interface HALLink {
  href: string;
  title?: string;
}

export interface HALLinks {
  self: HALLink;
  [key: string]: HALLink | HALLink[] | undefined;
}

export interface WorkPackage {
  id: number;
  subject: string;
  description?: {
    format: string;
    html: string;
    raw: string;
  };
  _links: HALLinks & {
    type: HALLink;
    status: HALLink;
    project: HALLink;
    assignee?: HALLink;
    priority: HALLink;
  };
  _type: string;
}

export interface Project {
  id: number;
  name: string;
  identifier: string;
  description?: {
    format: string;
    html: string;
    raw: string;
  };
  _links: HALLinks;
  _type: string;
}

export interface Status {
  id: number;
  name: string;
  isClosed: boolean;
  color: string;
  _links: HALLinks;
}

export interface Type {
  id: number;
  name: string;
  color: string;
  _links: HALLinks;
}

export interface User {
  id: number;
  name: string;
  email?: string;
  _links: HALLinks;
}

export interface CollectionResponse<T> {
  _type: string;
  total: number;
  count: number;
  pageSize: number;
  offset: number;
  _embedded: {
    elements: T[];
  };
  _links: HALLinks;
}

export interface Priority {
  id: number;
  name: string;
  isDefault: boolean;
  _links: HALLinks;
}

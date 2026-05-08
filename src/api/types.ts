export interface OpenProjectConfig {
  url: string;
  apiKey: string;
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

export interface HALLink {
  href: string;
  title?: string;
}

export interface HALLinks {
  self: HALLink;
  [key: string]: HALLink | HALLink[] | undefined;
}

export interface Project {
  id: number;
  favorited: boolean;
  name: string;
  identifier: string;
  description: {
    format: string;
    raw: string;
    html: string;
  };
  statusExplanation: {
    format: string;
    raw: string;
    html: string;
  };
  _links: HALLinks;
}

export interface WorkPackage {
  id: number;
  type: string;
  status: string;
  priority: string;
  subject: string;
  lockVersion: number;
  dueDate: Date;
  description?: {
    format: string;
    html: string;
    raw: string;
  };
  _links: HALLinks & {
    self: HALLink;
    type: HALLink;
    status: HALLink;
    project: HALLink;
    assignee?: HALLink;
    parent?: HALLink;
    children?: HALLink[];
    priority: HALLink;
  };
  _type: string;
}

export interface Status {
  id: number;
  name: string;
  _links: HALLinks;
}

export interface Type {
  id: number;
  name: string;
  _links: HALLinks;
}

export interface User {
  id: number;
  name: string;
  login: string;
  admin: boolean;
  _links: HALLinks;
}

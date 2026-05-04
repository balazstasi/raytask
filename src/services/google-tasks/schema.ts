import { Schema } from "effect";

const TaskLinkSchema = Schema.mutable(Schema.Struct({
  type: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  link: Schema.optional(Schema.String),
}));

const taskFields = {
  kind: Schema.optional(Schema.String),
  etag: Schema.optional(Schema.String),
  updated: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literal("needsAction", "completed")),
  due: Schema.optional(Schema.String),
  completed: Schema.optional(Schema.String),
  deleted: Schema.optional(Schema.Boolean),
  hidden: Schema.optional(Schema.Boolean),
  parent: Schema.optional(Schema.String),
  position: Schema.optional(Schema.String),
  links: Schema.optional(Schema.mutable(Schema.Array(TaskLinkSchema))),
  webViewLink: Schema.optional(Schema.String),
  assignmentInfo: Schema.optional(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.Unknown }))),
  selfLink: Schema.optional(Schema.String),
};

export const TaskSchema = Schema.mutable(Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  ...taskFields,
}));

export type Task = Schema.Schema.Type<typeof TaskSchema>;

export const TaskListSchema = Schema.mutable(Schema.Struct({
  kind: Schema.optional(Schema.String),
  id: Schema.String,
  etag: Schema.optional(Schema.String),
  title: Schema.String,
  updated: Schema.optional(Schema.String),
  selfLink: Schema.optional(Schema.String),
}));

export type TaskList = Schema.Schema.Type<typeof TaskListSchema>;

export const TaskListsResponseSchema = Schema.mutable(Schema.Struct({
  kind: Schema.optional(Schema.String),
  etag: Schema.optional(Schema.String),
  items: Schema.optional(Schema.mutable(Schema.Array(TaskListSchema))),
  nextPageToken: Schema.optional(Schema.String),
}));

export type TaskListsResponse = Schema.Schema.Type<typeof TaskListsResponseSchema>;

export const TasksResponseSchema = Schema.mutable(Schema.Struct({
  kind: Schema.optional(Schema.String),
  etag: Schema.optional(Schema.String),
  items: Schema.optional(Schema.mutable(Schema.Array(TaskSchema))),
  nextPageToken: Schema.optional(Schema.String),
}));

export type TasksResponse = Schema.Schema.Type<typeof TasksResponseSchema>;

export const GoogleTasksApiErrorBodySchema = Schema.mutable(Schema.Struct({
  error: Schema.optional(Schema.mutable(Schema.Struct({
    code: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
    errors: Schema.optional(Schema.mutable(Schema.Array(Schema.mutable(Schema.Struct({
      domain: Schema.optional(Schema.String),
      reason: Schema.optional(Schema.String),
      message: Schema.optional(Schema.String),
    }))))),
    status: Schema.optional(Schema.String),
    details: Schema.optional(Schema.mutable(Schema.Array(Schema.Unknown))),
  }))),
}));

export type GoogleTasksApiErrorBody = Schema.Schema.Type<typeof GoogleTasksApiErrorBodySchema>;

export const VoidSchema = Schema.Undefined;

// content-collections.ts
import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { compileMDX } from "@content-collections/mdx";
import remarkGfm from "remark-gfm";
import { z } from "zod";
async function compileRichContent(document, context) {
  const isMdx = document._meta.filePath.endsWith(".mdx");
  return {
    slug: document._meta.path,
    pubDate: new Date(document.pubDate).toISOString(),
    html: isMdx ? null : await compileMarkdown(context, document),
    mdx: isMdx ? await compileMDX(context, document, {
      remarkPlugins: [remarkGfm]
    }) : null
  };
}
var blog = defineCollection({
  name: "blog",
  directory: "content/blog",
  include: "**/*.{md,mdx}",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    content: z.string(),
    heroImage: z.string().optional()
  }),
  transform: async (document, context) => {
    return {
      ...document,
      ...await compileRichContent(document, context)
    };
  }
});
var digest = defineCollection({
  name: "digest",
  directory: "content/digest",
  include: "**/*.{md,mdx}",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    category: z.string(),
    content: z.string(),
    heroImage: z.string().optional(),
    sourceUrls: z.array(z.string().url()),
    slug: z.string().optional()
  }),
  transform: async (document, context) => {
    return {
      ...document,
      ...await compileRichContent(document, context)
    };
  }
});
var content_collections_default = defineConfig({
  collections: [blog, digest]
});
export {
  content_collections_default as default
};

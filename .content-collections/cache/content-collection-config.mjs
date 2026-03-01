// content-collections.ts
import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { compileMDX } from "@content-collections/mdx";
import remarkGfm from "remark-gfm";
import { z } from "zod";
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
    const isMdx = document._meta.filePath.endsWith(".mdx");
    return {
      ...document,
      slug: document._meta.path,
      pubDate: new Date(document.pubDate).toISOString(),
      html: isMdx ? null : await compileMarkdown(context, document),
      mdx: isMdx ? await compileMDX(context, document, {
        remarkPlugins: [remarkGfm]
      }) : null
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
    why: z.string().optional(),
    candidateCount: z.number().int().positive().optional(),
    content: z.string(),
    heroImage: z.string().optional(),
    sourceUrls: z.array(z.string().url()),
    sources: z.array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        sourceType: z.string().optional()
      })
    ).optional(),
    candidateItems: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        sourceName: z.string().optional(),
        sourceType: z.string().optional(),
        score: z.number().optional()
      })
    ).optional(),
    slug: z.string().optional()
  }),
  transform: async (document, context) => {
    const isMdx = document._meta.filePath.endsWith(".mdx");
    return {
      ...document,
      slug: document._meta.path,
      pubDate: new Date(document.pubDate).toISOString(),
      html: isMdx ? null : await compileMarkdown(context, document),
      mdx: isMdx ? await compileMDX(context, document, {
        remarkPlugins: [remarkGfm]
      }) : null
    };
  }
});
var content_collections_default = defineConfig({
  collections: [blog, digest]
});
export {
  content_collections_default as default
};

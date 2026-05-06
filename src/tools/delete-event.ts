import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CalDAVClient } from "ts-caldav";
import { z } from "zod";

type DeleteEventInput = {
	href: string;
	calendarUrl: string;
};

export function registerDeleteEvent(client: CalDAVClient, server: McpServer) {
	server.registerTool(
		"delete-event",
		{
			description:
				"Deletes an event from the calendar specified by its URL. Identify the event by the exact `href` returned from list-events.",
			inputSchema: {
				href: z
					.string()
					.describe("Exact event href as returned by list-events"),
				calendarUrl: z.string(),
			},
		},
		async (args: DeleteEventInput) => {
			const { href, calendarUrl } = args;
			const etag = await client.getETag(href);
			const filename =
				href
					.split("/")
					.pop()
					?.replace(/\.ics$/, "") ?? "";
			await client.deleteEvent(calendarUrl, filename, etag);

			return {
				content: [{ type: "text", text: "Event deleted" }],
			};
		},
	);
}

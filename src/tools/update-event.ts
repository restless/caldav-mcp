import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CalDAVClient, RecurrenceRule } from "ts-caldav";
import { z } from "zod";

type UpdateEventInput = {
	href: string;
	calendarUrl: string;
	summary?: string;
	start?: string;
	end?: string;
	description?: string;
	location?: string;
	recurrenceRule?: {
		freq?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
		interval?: number;
		count?: number;
		until?: string;
		byday?: string[];
		bymonthday?: number[];
		bymonth?: number[];
	};
};

const recurrenceRuleSchema = z.object({
	freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
	interval: z.number().optional(),
	count: z.number().optional(),
	until: z.string().datetime({ offset: true }).optional(),
	byday: z.array(z.string()).optional(),
	bymonthday: z.array(z.number()).optional(),
	bymonth: z.array(z.number()).optional(),
});

export function registerUpdateEvent(client: CalDAVClient, server: McpServer) {
	server.registerTool(
		"update-event",
		{
			description:
				"Updates an existing event in the calendar specified by its URL. Identify the event by the exact `href` returned from list-events. Only provided fields are changed.",
			inputSchema: {
				href: z
					.string()
					.describe("Exact event href as returned by list-events"),
				calendarUrl: z.string(),
				summary: z.string().optional(),
				start: z.string().datetime({ offset: true }).optional(),
				end: z.string().datetime({ offset: true }).optional(),
				description: z.string().optional(),
				location: z.string().optional(),
				recurrenceRule: recurrenceRuleSchema.optional(),
			},
		},
		async (args: UpdateEventInput) => {
			const {
				href,
				calendarUrl,
				summary,
				start,
				end,
				description,
				location,
				recurrenceRule,
			} = args;

			const [existing] = await client.getEventsByHref(calendarUrl, [href]);
			if (!existing) {
				throw new Error(`Event not found: ${href}`);
			}

			const updated = await client.updateEvent(calendarUrl, {
				...existing,
				...(summary !== undefined && { summary }),
				...(start !== undefined && { start: new Date(start) }),
				...(end !== undefined && { end: new Date(end) }),
				...(description !== undefined && { description }),
				...(location !== undefined && { location }),
				...(recurrenceRule !== undefined && {
					recurrenceRule: recurrenceRule as RecurrenceRule,
				}),
			});

			return {
				content: [{ type: "text", text: updated.uid }],
			};
		},
	);
}

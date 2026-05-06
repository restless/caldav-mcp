import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CalDAVClient } from "ts-caldav";
import { describe, expect, test, vi } from "vitest";
import { registerDeleteEvent } from "./delete-event.js";

type ToolHandler = (params: {
	calendarUrl: string;
	href: string;
}) => Promise<{ content: { type: string; text: string }[] }>;

function makeServer() {
	let toolHandler: ToolHandler | null = null;
	const server = new McpServer({ name: "test-server", version: "0.1.0" });
	const originalRegisterTool = server.registerTool.bind(server);
	server.registerTool = vi.fn(
		(name: string, config: unknown, handler: ToolHandler) => {
			if (name === "delete-event") toolHandler = handler;
			return originalRegisterTool(name, config, handler);
		},
	) as typeof server.registerTool;
	return { server, getHandler: () => toolHandler };
}

describe("registerDeleteEvent", () => {
	test("fetches etag for the given href and deletes via that href", async () => {
		const mockClient = {
			getETag: vi.fn().mockResolvedValue('"abc123"'),
			deleteEvent: vi.fn().mockResolvedValue(undefined),
		};

		const { server, getHandler } = makeServer();
		registerDeleteEvent(mockClient as unknown as CalDAVClient, server);
		const handler = getHandler();
		if (!handler) throw new Error("delete-event handler not registered");

		const result = await handler({
			calendarUrl: "/f/test-calendar/",
			href: "/f/test-calendar/event-123.ics",
		});

		expect(result.content[0].text).toBe("Event deleted");
		expect(mockClient.getETag).toHaveBeenCalledWith(
			"/f/test-calendar/event-123.ics",
		);
		// ts-caldav rebuilds href as `${calendarUrl}/${id}.ics`, so we pass the
		// filename stem from the href as the second arg to make the rebuild match
		// the actual server-side filename (which is not always the event's UID).
		expect(mockClient.deleteEvent).toHaveBeenCalledWith(
			"/f/test-calendar/",
			"event-123",
			'"abc123"',
		);
	});

	test("works for events stored under non-uid filenames", async () => {
		const mockClient = {
			getETag: vi.fn().mockResolvedValue('"etag-x"'),
			deleteEvent: vi.fn().mockResolvedValue(undefined),
		};

		const { server, getHandler } = makeServer();
		registerDeleteEvent(mockClient as unknown as CalDAVClient, server);
		const handler = getHandler();
		if (!handler) throw new Error("delete-event handler not registered");

		await handler({
			calendarUrl: "/cal/work/",
			href: "/cal/work/random-server-slug.ics",
		});

		expect(mockClient.getETag).toHaveBeenCalledWith(
			"/cal/work/random-server-slug.ics",
		);
		expect(mockClient.deleteEvent).toHaveBeenCalledWith(
			"/cal/work/",
			"random-server-slug",
			'"etag-x"',
		);
	});

	test("fetches etag before deleting", async () => {
		const mockClient = {
			getETag: vi.fn().mockResolvedValue('"etag"'),
			deleteEvent: vi.fn().mockResolvedValue(undefined),
		};

		const { server, getHandler } = makeServer();
		registerDeleteEvent(mockClient as unknown as CalDAVClient, server);
		const handler = getHandler();
		if (!handler) throw new Error("delete-event handler not registered");

		await handler({
			calendarUrl: "/cal/work/",
			href: "/cal/work/meeting-42.ics",
		});

		const etagOrder = mockClient.getETag.mock.invocationCallOrder[0];
		const deleteOrder = mockClient.deleteEvent.mock.invocationCallOrder[0];
		expect(etagOrder).toBeLessThan(deleteOrder);
	});
});

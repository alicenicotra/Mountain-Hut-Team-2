import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyHikesPage from "../../../src/hikes/pages/MyHikesPage.tsx";
import { getMyHikes } from "../../../src/hikes/api/hikes-api.ts";
import type { Hike } from "../../../src/hikes/types/hike.ts";

vi.mock("../../../src/hikes/api/hikes-api.ts", () => ({
  getMyHikes: vi.fn(),
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Relative to now, so that the phases do not change as time goes by
function hike(id: number, startsIn: number, lasts: number, extra: Partial<Hike> = {}): Hike {
  const departure = Date.now() + startsIn;
  return {
    id,
    userId: 1,
    departureAt: new Date(departure).toISOString(),
    expectedReturnAt: new Date(departure + lasts).toISOString(),
    destination: `Destination ${id}`,
    routeDescription: `Route ${id}`,
    intermediatePoints: [],
    emergencyContactPhone: null,
    createdAt: "2030-06-01 10:00:00",
    ...extra,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <MyHikesPage />
    </MemoryRouter>,
  );
}

describe("MyHikesPage (MH-140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows placeholders while the hikes are loading", () => {
    vi.mocked(getMyHikes).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByLabelText("Loading hikes")).toBeInTheDocument();
  });

  it("splits the hikes into in progress, upcoming and past", async () => {
    // As the API returns them: the latest departure first
    vi.mocked(getMyHikes).mockResolvedValue([
      hike(4, 3 * DAY, 5 * HOUR),
      hike(3, 2 * DAY, 5 * HOUR),
      hike(2, -1 * HOUR, 4 * HOUR),
      hike(1, -3 * DAY, 6 * HOUR),
    ]);

    renderPage();

    const inProgress = within(await screen.findByRole("region", { name: "Hikes in progress" }));
    expect(inProgress.getAllByRole("listitem")).toHaveLength(1);
    expect(inProgress.getByText("Route 2")).toBeInTheDocument();
    expect(inProgress.getByText("In progress")).toBeInTheDocument();
    expect(inProgress.getByText(/^Expected back/)).toBeInTheDocument();

    const upcoming = within(screen.getByRole("region", { name: "Upcoming hikes" }));
    const upcomingRoutes = upcoming
      .getAllByRole("listitem")
      .map((item) => within(item).getByText(/^Route \d$/).textContent);
    expect(upcomingRoutes).toEqual(["Route 3", "Route 4"]);

    const past = within(screen.getByRole("region", { name: "Past hikes" }));
    expect(past.getAllByRole("listitem")).toHaveLength(1);
    expect(past.getByText("Route 1")).toBeInTheDocument();
    expect(past.queryByText(/^Expected back/)).not.toBeInTheDocument();

    const order = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));
    expect(order).toEqual(["Hikes in progress", "Upcoming hikes", "Past hikes"]);
  });

  it("puts the hike that is due back first among those in progress", async () => {
    vi.mocked(getMyHikes).mockResolvedValue([
      hike(2, -1 * HOUR, 8 * HOUR),
      hike(1, -2 * HOUR, 4 * HOUR),
    ]);

    renderPage();

    const inProgress = within(await screen.findByRole("region", { name: "Hikes in progress" }));
    const routes = inProgress
      .getAllByRole("listitem")
      .map((item) => within(item).getByText(/^Route \d$/).textContent);
    expect(routes).toEqual(["Route 1", "Route 2"]);
  });

  it("shows how long the hike lasts and the emergency contact", async () => {
    vi.mocked(getMyHikes).mockResolvedValue([
      hike(1, 2 * DAY, 5 * HOUR, { emergencyContactPhone: "+39 333 123 4567" }),
    ]);

    renderPage();

    expect(await screen.findByText("Out for 5 h")).toBeInTheDocument();
    expect(screen.getByText("Emergency contact: +39 333 123 4567")).toBeInTheDocument();
  });

  it("shows the destination and the stops of a hike", async () => {
    vi.mocked(getMyHikes).mockResolvedValue([
      hike(1, 2 * DAY, 5 * HOUR, { destination: "Lake", intermediatePoints: ["Pass", "Ridge"] }),
    ]);

    renderPage();

    expect(await screen.findByText("Lake")).toBeInTheDocument();
    expect(screen.getByText("Via Pass → Ridge")).toBeInTheDocument();
  });

  it("hides the sections without hikes", async () => {
    vi.mocked(getMyHikes).mockResolvedValue([hike(1, 2 * DAY, 5 * HOUR)]);

    renderPage();

    expect(await screen.findByRole("region", { name: "Upcoming hikes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Hikes in progress" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Past hikes" })).not.toBeInTheDocument();
  });

  it("says so when there are no hikes, with a link to register one", async () => {
    vi.mocked(getMyHikes).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("You haven't registered any hikes yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register a hike" })).toHaveAttribute("href", "/hikes");
  });

  it("shows the error when the hikes cannot be loaded", async () => {
    vi.mocked(getMyHikes).mockRejectedValue(new Error("API error 500"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your hikes: API error 500",
    );
    expect(screen.queryByText("You haven't registered any hikes yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
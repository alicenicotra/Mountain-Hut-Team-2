import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterHikePage from "../../../src/hikes/pages/RegisterHikePage.tsx";
import { registerHike } from "../../../src/hikes/api/hikes-api.ts";
import { addHours, localInputToIso } from "../../../src/hikes/utils/hike-time.ts";
import { SUGGESTED_ROUTES } from "../../../src/hikes/utils/suggested-routes.ts";
import { ApiError } from "../../../src/shared/api/client.ts";

// Only the call to the backend is replaced: the page logic is the real one
vi.mock("../../../src/hikes/api/hikes-api.ts", () => ({
  registerHike: vi.fn(),
}));

const [LAKE, RIDGE] = SUGGESTED_ROUTES;

function savedHike() {
  return {
    id: 7,
    userId: 1,
    departureAt: "2030-06-15T06:00:00.000Z",
    expectedReturnAt: "2030-06-15T09:00:00.000Z",
    destination: LAKE.destination,
    routeDescription: LAKE.description,
    intermediatePoints: LAKE.points,
    emergencyContactPhone: null,
    createdAt: "2030-06-01 10:00:00",
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <RegisterHikePage />
    </MemoryRouter>,
  );
  return { user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const destinationField = () => screen.getByLabelText("Destination") as HTMLInputElement;
const routeField = () => screen.getByLabelText("Route details") as HTMLTextAreaElement;
const stopField = () => screen.getByLabelText(/Stops along the way/) as HTMLInputElement;
const departureField = () => screen.getByLabelText("Departure") as HTMLInputElement;
const returnField = () => screen.getByLabelText("Expected return") as HTMLInputElement;
const phoneField = () => screen.getByLabelText(/Emergency contact/) as HTMLInputElement;
const routeCard = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const backIn = (label: string) => screen.getByRole("button", { name: label });
const addStopButton = () => screen.getByRole("button", { name: "Add" });
const registerButton = () => screen.getByRole("button", { name: "Register hike" });

// The stops shown as chips, without their number and remove button
function stopNames(): string[] {
  const list = screen.queryByRole("list", { name: "Stops" });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((item) => (item.textContent ?? "").replace(/^\d+\.\s*/, "").replace(/×$/, "").trim());
}

async function fillOwnHike(user: User) {
  await user.type(destinationField(), "Old bivouac");
  await user.type(routeField(), "Up the valley path");
}

describe("RegisterHikePage (MH-140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("starting values", () => {
    it("suggests the next full hour as departure and leaves the rest empty", () => {
      renderPage();

      expect(departureField().value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
      expect(Date.parse(departureField().value)).toBeGreaterThan(Date.now());
      expect(returnField()).toHaveValue("");
      expect(destinationField()).toHaveValue("");
      expect(routeField()).toHaveValue("");
      expect(stopNames()).toEqual([]);
    });
  });

  describe("suggested routes", () => {
    it("fills in the destination, stops, description and return of the chosen route", async () => {
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(routeCard(LAKE.name));

      expect(routeCard(LAKE.name)).toHaveAttribute("aria-pressed", "true");
      expect(destinationField()).toHaveValue(LAKE.destination);
      expect(stopNames()).toEqual(LAKE.points);
      expect(routeField()).toHaveValue(LAKE.description);
      expect(returnField()).toHaveValue(addHours(departure, LAKE.hours));
      expect(backIn("3 h")).toHaveAttribute("aria-pressed", "true");
    });

    it("moves the return when the departure changes", async () => {
      const { user } = renderPage();
      await user.click(routeCard(RIDGE.name));

      fireEvent.change(departureField(), { target: { value: "2031-01-10T06:00" } });

      expect(returnField()).toHaveValue("2031-01-10T11:00");
    });

    it("clears what a suggested route filled in when switching to my own route", async () => {
      const { user } = renderPage();
      await user.click(routeCard(LAKE.name));

      await user.click(routeCard("My own route"));

      expect(destinationField()).toHaveValue("");
      expect(routeField()).toHaveValue("");
      expect(stopNames()).toEqual([]);
      expect(routeCard(LAKE.name)).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps what the hiker typed when choosing my own route", async () => {
      const { user } = renderPage();
      await fillOwnHike(user);

      await user.click(routeCard("My own route"));

      expect(destinationField()).toHaveValue("Old bivouac");
      expect(routeField()).toHaveValue("Up the valley path");
    });
  });

  describe("stops", () => {
    it("adds a stop with Enter without sending the form", async () => {
      const { user } = renderPage();

      await user.type(stopField(), "Lake shore{Enter}");

      expect(stopNames()).toEqual(["Lake shore"]);
      expect(stopField()).toHaveValue("");
      expect(registerHike).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps the stops in order and removes one", async () => {
      const { user } = renderPage();

      await user.type(stopField(), "Pass");
      await user.click(addStopButton());
      await user.type(stopField(), "Ridge{Enter}");
      expect(stopNames()).toEqual(["Pass", "Ridge"]);

      await user.click(screen.getByRole("button", { name: "Remove Pass" }));

      expect(stopNames()).toEqual(["Ridge"]);
    });

    it("does not add an empty stop", async () => {
      const { user } = renderPage();

      expect(addStopButton()).toBeDisabled();
      await user.type(stopField(), "   {Enter}");

      expect(stopNames()).toEqual([]);
    });
  });

  describe("expected return", () => {
    it("sets the return with a Back in button", async () => {
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(backIn("8 h"));

      expect(returnField()).toHaveValue(addHours(departure, 8));
      expect(screen.getByText(/out for 8 h/)).toBeInTheDocument();
    });

    it("warns when the return is before the departure", () => {
      renderPage();

      fireEvent.change(returnField(), {
        target: { value: addHours(departureField().value, -1) },
      });

      expect(
        screen.getByText("The expected return must be after the departure."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/out for/)).not.toBeInTheDocument();
    });
  });

  describe("registering", () => {
    it("sends the hike and confirms it, then resets the form", async () => {
      vi.mocked(registerHike).mockResolvedValue(savedHike());
      const { user } = renderPage();
      const departure = departureField().value;

      await user.click(routeCard(LAKE.name));
      await user.type(phoneField(), "+39 333 123 4567");
      await user.click(registerButton());

      expect(registerHike).toHaveBeenCalledWith({
        departureAt: localInputToIso(departure),
        expectedReturnAt: localInputToIso(addHours(departure, LAKE.hours)),
        destination: LAKE.destination,
        routeDescription: LAKE.description,
        intermediatePoints: LAKE.points,
        emergencyContactPhone: "+39 333 123 4567",
      });
      expect(await screen.findByRole("status")).toHaveTextContent(
        `Hike to ${LAKE.destination} registered.`,
      );
      expect(screen.getByRole("link", { name: "See my hikes" })).toHaveAttribute(
        "href",
        "/my-hikes",
      );
      expect(destinationField()).toHaveValue("");
      expect(routeField()).toHaveValue("");
      expect(stopNames()).toEqual([]);
      expect(returnField()).toHaveValue("");
      expect(phoneField()).toHaveValue("");
    });

    it("hides the error as soon as the hiker changes something", async () => {
      const { user } = renderPage();
      await user.click(registerButton());
      expect(screen.getByRole("alert")).toHaveTextContent("Enter your destination.");

      await user.type(destinationField(), "L");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("leaves out the stops and the contact when they are empty", async () => {
      vi.mocked(registerHike).mockResolvedValue(savedHike());
      const { user } = renderPage();

      await fillOwnHike(user);
      await user.click(backIn("3 h"));
      await user.click(registerButton());

      expect(registerHike).toHaveBeenCalledTimes(1);
      const sent = vi.mocked(registerHike).mock.calls[0][0];
      expect(sent).toMatchObject({ destination: "Old bivouac", routeDescription: "Up the valley path" });
      expect(sent).not.toHaveProperty("intermediatePoints");
      expect(sent).not.toHaveProperty("emergencyContactPhone");
    });

    it.each([
      ["an empty form", async () => {}, "Enter your destination."],
      [
        "no route",
        async (user: User) => {
          await user.type(destinationField(), "Old bivouac");
        },
        "Describe your route.",
      ],
      [
        "no return time",
        async (user: User) => {
          await fillOwnHike(user);
        },
        "Choose when you expect to be back.",
      ],
    ])("does not call the backend with %s", async (_name, fill, message) => {
      const { user } = renderPage();

      await fill(user);
      await user.click(registerButton());

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(registerHike).not.toHaveBeenCalled();
    });

    it("does not call the backend when the return is before the departure", async () => {
      const { user } = renderPage();
      await fillOwnHike(user);
      fireEvent.change(returnField(), {
        target: { value: addHours(departureField().value, -1) },
      });

      await user.click(registerButton());

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Expected return must be after departure.",
      );
      expect(registerHike).not.toHaveBeenCalled();
    });

    it.each([
      [new ApiError(400, "Departure must be in the future"), "Departure must be in the future"],
      [new ApiError(403, "Insufficient permissions"), "Only hikers can register a hike."],
      [new ApiError(401, "Authentication required"), "Please log in to register a hike."],
      [new Error("network down"), "Something went wrong. Please try again."],
    ])("shows the error and keeps what was entered (%s)", async (error, message) => {
      vi.mocked(registerHike).mockRejectedValue(error);
      const { user } = renderPage();

      await user.click(routeCard(LAKE.name));
      await user.click(registerButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(destinationField()).toHaveValue(LAKE.destination);
      expect(routeField()).toHaveValue(LAKE.description);
    });
  });
});
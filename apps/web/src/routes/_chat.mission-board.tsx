import { createFileRoute } from "@tanstack/react-router";

import { MissionBoard } from "../components/MissionBoard";

function MissionBoardRoute() {
  return <MissionBoard />;
}

export const Route = createFileRoute("/_chat/mission-board")({
  component: MissionBoardRoute,
});

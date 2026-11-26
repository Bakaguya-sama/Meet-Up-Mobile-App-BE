import { Injectable, Logger } from '@nestjs/common';
import type { PreferenceSuggestionTelemetryPort } from '../../application/ports/preference-suggestion-telemetry.port';

@Injectable()
export class MeetupPreferenceSuggestionTelemetryAdapter implements PreferenceSuggestionTelemetryPort {
  private readonly logger = new Logger(
    MeetupPreferenceSuggestionTelemetryAdapter.name,
  );

  recordSuggestion(
    input: Parameters<PreferenceSuggestionTelemetryPort['recordSuggestion']>[0],
  ): void {
    this.logger.log(
      JSON.stringify({ event: 'meetup_preference_suggestion', ...input }),
    );
  }

  recordConfirmation(
    input: Parameters<
      PreferenceSuggestionTelemetryPort['recordConfirmation']
    >[0],
  ): void {
    this.logger.log(
      JSON.stringify({ event: 'meetup_preference_confirmation', ...input }),
    );
  }
}

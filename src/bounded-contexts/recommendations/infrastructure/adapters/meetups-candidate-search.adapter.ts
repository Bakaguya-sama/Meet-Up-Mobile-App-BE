import { Injectable } from '@nestjs/common';
import { MeetupCandidateSearchReader as MeetupsCandidateSearchReader } from '../../../meetups/application/public/meetup-candidate-search-reader';
import type {
  MeetupCandidateSearchContext,
  MeetupCandidateSearchPort,
} from '../../application/ports/meetup-candidate-search.port';

@Injectable()
export class MeetupsCandidateSearchAdapter implements MeetupCandidateSearchPort {
  constructor(private readonly meetups: MeetupsCandidateSearchReader) {}

  getCandidateSearchContext(
    actorId: string,
    meetupId: string,
  ): Promise<MeetupCandidateSearchContext> {
    return this.meetups.getCandidateSearchContext(actorId, meetupId);
  }
}

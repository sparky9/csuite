import personas from './personas.json';

export interface PersonaDefinition {
  id: string;
  name: string;
  tone: string;
  expertise: string[];
  maxTokens: number;
  streamChunkSize: number;
  focus: string;
  requiredContext: string[];
}

export const PERSONAS: PersonaDefinition[] = personas satisfies PersonaDefinition[];

export function getPersonaById(personaId: string): PersonaDefinition | undefined {
  return PERSONAS.find((persona) => persona.id === personaId);
}

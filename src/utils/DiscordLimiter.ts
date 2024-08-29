export class DiscordLimiter {
  static StringSelectMenu = {
    limitDescription(description: string): string {
      const maxLength = 100;
      if (description.length <= maxLength) {
        return description;
      }
      return description.slice(0, maxLength - 3) + '...';
    },
  };

  static EmbedBuilder = {
    limitTitle(title: string): string {
      const maxLength = 256;
      if (title.length <= maxLength) {
        return title;
      }
      return title.slice(0, maxLength - 3) + '...';
    },
    limitDescription(description: string): string {
      const maxLength = 4096;
      if (description.length <= maxLength) {
        return description;
      }
      return description.slice(0, maxLength - 3) + '...';
    },
    limitField(field: string): string {
      const maxLength = 256;
      if (field.length <= maxLength) {
        return field;
      }
      return field.slice(0, maxLength - 3) + '...';
    },
    limitFieldValue(field: string): string {
      const maxLength = 1024;
      if (field.length <= maxLength) {
        return field;
      }
      return field.slice(0, maxLength - 3) + '...';
    },
  };

  static limitTo100(str: string): string {
    const maxLength = 100;
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 3) + '...';
  }

  static limitTo50(str: string): string {
    const maxLength = 50;
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 3) + '...';
  }

  static limitTo25(str: string): string {
    const maxLength = 25;
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 3) + '...';
  }
}

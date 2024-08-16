export class InputDate {
    static toDate(date: string): Date {
        return new Date(`${date} UTC`);
    }
}
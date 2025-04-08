import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'groupBy',
    standalone: true  
})
export class GroupByPipe implements PipeTransform {
    transform(collection: any[], property: string): any[][] {
        if (!collection || collection.length === 0) return [];

        const groupedCollection = collection.reduce((result, item) => {
            const key = item[property]; 
            if (!result[key]) {
                result[key] = [];
            }
            result[key].push(item);
            return result;
        }, {} as Record<string, any[]>);

        console.log('Grouped Data123:', groupedCollection); 
        return Object.values(groupedCollection);
    }
}

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-revision-modal',
    templateUrl: './confirmation-dialog.component.html',
    styleUrls: ['./confirmation-dialog.component.scss']
})
export class ConfirmationDialogComponent {
    public title: string = null;
    public subtitle: string = null;
    public warning: string = null;
    public confirm: string = 'Si, eliminar';
    public showWarning: boolean = false;

    constructor(
        public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.title = this.data.title;
        this.subtitle = this.data.subtitle;
        if (this.data.confirm) this.warning = this.data.warning;
        if (this.data.confirm) this.confirm = this.data.confirm; 
        if (this.data.showWarning) this.showWarning = this.data.showWarning;    
    }

    closeDialog(alert?: boolean): void {
        this.dialogRef.close(alert);
    }

}

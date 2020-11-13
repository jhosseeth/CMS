
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormGroup, FormArray, FormControl } from '@angular/forms';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { Report } from '../../board/board.model';
import { loopback } from '../../../../models/common/loopback.model';
import { PreviewDialogComponent } from '../../preview-dialog/preview-dialog.component';
import { HighlightDialogComponent } from '../highlight-dialog/highlight-dialog.component';
import { CreateReportDialogComponent } from '../create-report-dialog/create-report-dialog.component';
import { ConfirmationDialogComponent } from '../../board/confirmation-dialog/confirmation-dialog.component';

import * as moment from 'moment';
import { AuthService } from '../../../../services/auth.service';
import { HttpService } from '../../../../services/http.service';
import { AsideFoldersService } from 'src/app/services/aside-folders.service';

@Component({
    selector: 'app-right-content',
    templateUrl: './right-content.component.html',
    styleUrls: ['./right-content.component.scss']
})
export class RightContentComponent implements OnInit {

    @Output() valueChange = new EventEmitter();

    readonly DRAFT_KEY: string = environment.DRAFT_KEY;

    public calendarOpen: boolean = false;
    public startDate: any;
    public endDate: any;

    user: any = {};
    icurrentObj: {
        currentFolder: null,
        currentState: null,
        deletedFg: false,
        currentStateName: 'Todos Informes'
    };

    ifilter: string;
    ifilterdate: any;
    ifilterreviewed: boolean = true;
    isReviewed: boolean;
    isFiltered: boolean = false;
    pendingToReview = false;
    public list: any = {
        reports: [],
        folders: [],
        reviewed: [],
        notReviewed: []
    }
    public pager: any = {
        limit: 10,
        selected: 1,
        totalItems: 0,
        totalPages: 0,
        pages: []
    }
    public listForm: FormGroup;
    public remarkable: boolean = false;
    public filterOptions: any;

    @Input()
    set currentObj(value: any) {
        this.icurrentObj = value;

        if (this.icurrentObj) {
            this.loadReports(this.ifilter);
        }
    }

    constructor(
        public dialog: MatDialog,
        private router: Router,
        private http: HttpService,
        private auth: AuthService,
        private folderService: AsideFoldersService
    ) {
        this.listForm = new FormGroup({
            'reports': new FormArray([])
        });
        this.user = this.auth.getUserData();
    }

    toggleCalendar() {
        if (!this.calendarOpen) {
            this.calendarOpen = true;
        } else {
            this.calendarOpen = false;
        }
    }

    openDialog(): void {
        this.dialog.open(CreateReportDialogComponent, {
            width: '1500px',
            data: {
                'folderId': (this.icurrentObj.currentFolder ? this.icurrentObj.currentFolder : false),
                'stateId': '5e068d1cb81d1c5f29b62977'
            }
        });
    }

    ngOnInit() {
        this.loadReports();
        this.getFolders();
        this.setFilterOptions();
    }

    public setFilterOptions() {
        this.filterOptions = [{
            value: 'Proceso de revisión',
            filter: false
        }, {
            value: 'Informes revisados',
            filter: true
        }];
    }

    private saveReport(clone: any): void {
        this.http.post({
            'path': 'reports',
            'data': clone
        }).subscribe(() => {
            this.loadReports();
            this.folderService.loadStates();
            this.folderService.loadFolders();
        });
    }

    private getFolders(): void {
        this.folderService.$listenFolders.subscribe((data: any) => {
            this.list.folders = data;
        })
    }

    public gotoPage(input: string) {
        this.router.navigate(['app/board', input]);
    }

    public tabClick(event: any) {
        this.ifilterreviewed = (event.index === 0 ? true : false);
        this.loadReports(this.ifilter);
        this.isFiltered = false;
    }

    public reviewedFilter(event) {
        this.isFiltered = true;
        this.isReviewed = event.filter;
        this.loadReports(this.ifilter);
    }

    public reviewredFilter(list, isReviewed) {
        return list.filter((element) => element.reviewed === isReviewed);
    }

    public getNotReviewed(reportList) {
        if (!this.isFiltered) {
            this.list.reports = this.reviewredFilter(reportList, false);
        }
        return this.reviewredFilter(reportList, true)
    }

    private loadPager(where: any): void {
        this.http.get({
            path: 'reports/count?where=',
            data: where
        }).subscribe((response: any) => {
            this.pager.totalItems = response.body.count;
            this.pager.totalPages = Math.ceil(this.pager.totalItems / this.pager.limit);
            this.pager.selected = 1;
            this.pager.pages = [];
            for (let i = 1; i <= this.pager.totalPages; i++) {
                this.pager.pages.push({
                    'skip': (i - 1) * this.pager.limit,
                    'index': i
                });
            }
        });
    }

    public getIFilterIds(endpoint: string, property: string, fn: any): void {
        let result: Array<string> = [];
        if (!this.ifilter) return fn(result);
        var query = new loopback();
        query.filter.where['name'] = { like: this.ifilter, options: "i" };
        query.filter.fields = { id: true };
        this.http.get({
            path: endpoint,
            data: query.filter,
            encode: true
        }).subscribe((response: any) => {
            result = response.body.map((a: any) => {
                let item: any = {};
                item[property] = a.id;
                return item;
            });
            fn(result);
        });
    }

    public loadReports(filter?: string | null, pager?: any): void {
        this.ifilter = filter;
        var query = new loopback();
        query.filter.where = { and: [] };
        query.filter.where['and'].push({ trash: typeof this.icurrentObj.deletedFg !== 'undefined' ? this.icurrentObj.deletedFg : false });
        query.filter.include.push(
            { relation: "folder" },
            { relation: "user" },
            { relation: "state" },
            { relation: "section" }
        );

        if (this.ifilterdate) {
            let start = moment(this.ifilterdate.start).subtract(5, 'hours').toISOString();
            let end = moment(this.ifilterdate.end).subtract(5, 'hours').toISOString();
            query.filter.where['and'].push({ updatedAt: { between: [start, end] } });
        }

        this.getIFilterIds('users', 'userId', (users: Array<any>) => {
            this.getIFilterIds('states', 'stateId', (states: Array<any>) => {
                this.getIFilterIds('sections', 'sectionId', (sections: Array<any>) => {
                    this.readReportsAsReviewer((reportsAsReviewer: Array<any>) => {
                        if (this.ifilter) {
                            let orWhere: Array<any> = [
                                { name: { like: this.ifilter, options: "i" } }
                            ].concat(users, states, sections);
                            query.filter.where['and'].push({ or: orWhere });
                        } else {
                            if (this.icurrentObj.currentFolder && this.icurrentObj.currentFolder != 'shared') {
                              query.filter.where['and'].push({ folderId: this.icurrentObj.currentFolder });
                            }
                            this.icurrentObj.currentState ? query.filter.where['and'].push({ stateId: this.icurrentObj.currentState }) : null;
                        }

                        let pendingWhere;
                        if (this.icurrentObj.currentFolder && this.icurrentObj.currentFolder == 'shared') {
                          query.filter.include.push({ relation: "authors" });
                        } else {
                          if (this.icurrentObj.currentState == '5e068d1cb81d1c5f29b62976' && this.ifilterreviewed) {
                              let iFilterReviewed = false;
                              query.filter.where['and'].push({ reviewed: iFilterReviewed });
                          }

                          pendingWhere = JSON.parse(JSON.stringify(query.filter.where));
                          if (this.ifilterreviewed) {
                              query.filter.where['and'].push({ ownerId: this.user.id });
                          } else {
                              query.filter.where['and'].push({ id: { inq: reportsAsReviewer } });
                              if (this.isFiltered) {
                                  query.filter.where['and'].push({ reviewed: this.isReviewed });
                              }
                          }
                        }

                        pendingWhere['and'].push({ id: { inq: reportsAsReviewer } });
                        pendingWhere['and'].push({ reviewed: false });
                        this.pendignForReview(pendingWhere);

                        if (pager) {
                            query.filter.limit = this.pager.limit;
                            query.filter.skip = pager.skip;
                            this.pager.selected = pager.index;
                        } else {
                            this.loadPager(query.filter.where);
                            query.filter.limit = this.pager.limit;
                            query.filter.skip = 0;
                        }
                        query.filter.order = "id DESC";

                        this.clearCheckboxes(this.listForm.controls.reports as FormArray);
                        this.getReports(query);
                    });
                });
            });
        });
    }

    private getReports(query: any) {
        let path = (this.icurrentObj.currentFolder && this.icurrentObj.currentFolder == 'shared') ? `users/${this.user.id}/reportsa` : 'reports';
        this.list.reports = [];
        this.http.get({
            path: path,
            data: query.filter,
            encode: true
        }).subscribe((response: any) => {
            this.addCheckboxes(response.body);
            setTimeout(() => {
                this.list.reports = response.body;
                if (!this.ifilterreviewed) {
                    this.list.reviewed = this.getNotReviewed(this.list.reports);
                }
            }, 100);
        });
    }

    public pendignForReview(where: any) {
        this.http.get({
            path: 'reports/count?where=',
            data: where
        }).subscribe((response: any) => {
            this.pendingToReview = response.body.count > 0;
        });
    }

    private addCheckboxes(reports: Array<any>): void {
        for (let iReport in reports) {
            if (reports.hasOwnProperty(iReport)) {
                const control = new FormControl(false);
                (this.listForm.controls.reports as FormArray).push(control);
            }
        }
    }

    private clearCheckboxes(formArray: FormArray): void {
        while (formArray.length !== 0) {
            formArray.removeAt(0);
        }
    }

    public getCheckboxesSelected(): Array<any> {
        return this.listForm.value.reports
            .map((v: any, i: number) => v ? this.list.reports[i].id : null)
            .filter((v: any) => v !== null);
    }

    public moveReports(event: any): void {
        let selecteds: Array<string> = this.getCheckboxesSelected();
        let toUpdate: Array<any> = this.list.reports.filter((a: any) => {
            if (selecteds.indexOf(a.id) !== -1) {
                a.folderId = event.value;
                return true;
            }
            return false;
        });

        this.rcPutReport(toUpdate, 0, () => {
            let folder = this.list.folders.filter((a: any) => a.id == event.value)[0];
            if (!folder) return;
            this.valueChange.emit({
                state: this.icurrentObj.currentState,
                deleted: this.icurrentObj.deletedFg,
                folder: folder.id,
                stateName: folder.name
            });
            this.dialog.open(ConfirmationDialogComponent, {
                width: '410px',
                data: {
                    title: 'Su informe ha sido agregado exitosamente a:',
                    subtitle: folder.name
                }
            });

            this.folderService.loadFolders();
            this.folderService.loadStates();
            this.loadReports(this.ifilter);
            this.folderService.newActive = folder;
        });
    }

    public readReportsAsReviewer(fn: any): void {
        let result = [];

        this.http.get({
            path: `users/${this.user.id}/reportsr`,
            data: { "fields": "id" },
            encode: true
        }).subscribe(
            (response: any) => {
                result = response.body.map((a: any) => a.id);
                fn(result);
            },
            () => {
                alert('Oops!!! \nNo cargamos tus datos. Intenta más tarde');
            }
        );
    }

    public restoreReports(): void {
        let selecteds: Array<string> = this.getCheckboxesSelected();
        let toUpdate: Array<any> = this.list.reports.filter((a: any) => {
            if (selecteds.indexOf(a.id) !== -1) {
                a.trash = false;
                return true;
            }
            return false;
        });

        this.rcPutReport(toUpdate, 0, () => {
            this.loadReports(this.ifilter);
            this.folderService.loadFolders();
            this.folderService.loadStates();
        });
    }

    public deleteReports(): void {
        let dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '410px',
            data: {
                title: '',
                subtitle: '¿Esta seguro que desea eliminar el reporte?',
                alert: true
            }
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (!result) return;
            let selecteds: Array<string> = this.getCheckboxesSelected();
            let toUpdate: Array<any> = this.list.reports.filter((a: any) => {
                if (selecteds.indexOf(a.id) !== -1) {
                    a.trash = true;
                    return true;
                }
                return false;
            });

            this.rcPutReport(toUpdate, 0, () => {
                this.loadReports(this.ifilter);
                this.folderService.loadFolders();
                this.folderService.loadStates();
            });
        });
    }

    public deleteAllReports(): void {
        let dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '410px',
            data: {
                title: '',
                subtitle: '¿Esta seguro que desea vaciar la papelera?',
                alert: true
            }
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (!result) return;
            this.http.get({
                path: 'reports/',
                data: {
                    where: {
                        ownerId: this.user.id,
                        trash: true
                    },
                    fields: ['id']
                },
                encode: true
            }).subscribe((response: any) => {
                if (!response || !response.body || !response.body.length) return;
                let toDelete = response.body.map((a: any) => a.id);
                this.rcDeeplyDeleteReport(toDelete, 0, () => {
                    this.loadReports(this.ifilter);
                });
            }, (error: any) => {
                console.error(error);
            });
        });
    }

    public deeplyDeleteReports(): void {
        let dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '410px',
            data: {
                title: '',
                subtitle: '¿Esta seguro que desea eliminar el reporte?',
                alert: true
            }
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (!result) return;
            let reports: Array<string> = this.getCheckboxesSelected();
            this.rcDeeplyDeleteReport(reports, 0, () => {
                this.loadReports(this.ifilter);
            });
        });
    };

    public rcDeeplyDeleteReport(reports: Array<any>, index: number, fn: any) {
        if(index == reports.length) return fn();
        let report = reports[index];
        this.http.delete({
            path: `reports/${report}`
        }).subscribe(() => {
            index++;
            this.rcDeeplyDeleteReport(reports, index, fn);
        }, (error: any) => {
            console.error(error);
        });
    }

    private rcPutReport(reports: Array<any>, index: number, fn: any): void {
        if (index == reports.length) {
            fn();
            return;
        }
        let report: any = reports[index];
        let data: Report = {
            'id': report.id,
            'name': report.name,
            'slug': report.slug,
            'trash': report.trash,
            'content': report.content,
            'styles': report.styles,
            'sectionTypeKey': report.sectionTypeKey,
            'templateId': report.templateId,
            'stateId': report.stateId,
            'sectionId': report.sectionId,
            'folderId': report.folderId
        };
        this.http.patch({
            'path': `reports/${data.id}`,
            'data': data
        }).subscribe(
            () => {
                index++;
                this.rcPutReport(reports, index, fn);
            },
            () => {
                alert('Oops!!! \nNo actualizamos tus datos. Intenta más tarde');
            }
        );
    }

    public filterReports(text: string) {
        this.loadReports(text);
    }

    public filterDateReports() {
        this.ifilterdate = {
            start: this.startDate,
            end: this.endDate
        };

        this.calendarOpen = false;
        this.loadReports(this.ifilter);
    }

    public onDateUpdate(event: any) {
        this.startDate = event.startDate.toString();
        this.endDate = event.endDate.toString().replace('00:00:00', '23:59:59');
    }

    isFiltering() {
        return this.icurrentObj.currentFolder || this.icurrentObj.currentState ||
            this.icurrentObj.deletedFg;
    }

    cleanFilters() {
        this.icurrentObj = {
            currentFolder: null,
            currentState: null,
            deletedFg: false,
            currentStateName: 'Todos Informes'
        };
        this.loadReports();
        this.valueChange.emit(null);
    }

    public onCloneReport(pos: number) {
        let clone = Object.assign({}, this.list.reports[pos]);
        clone.name = `Duplicado ${clone.name}`;
        clone.slug = `duplicado-${clone.slug}`;

        let newReport: any = {
            name: clone.name,
            slug: clone.slug,
            trash: false,
            content: clone.content,
            styles: clone.styles,
            sectionTypeKey: clone.sectionTypeKey,
            templateId: clone.templateId,
            userId: clone.userId,
            stateId: this.DRAFT_KEY,
            sectionId: clone.sectionId,
            folderId: clone.folderId
        };

        this.saveReport(newReport);
    }

    public onDeleteReport(pos: number) {

        let isOutTrash = (!this.icurrentObj.deletedFg);
        let dialogTitle = isOutTrash ? '¿Está seguro de enviar el reporte a la papelera?' : '¿Está seguro de eliminar definitivamente el reporte?';
        let reportId = this.list.reports[pos].id;
        let reportName = this.list.reports[pos].name;
        let dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '410px',
            data: {
                title: dialogTitle,
                subtitle: '',
                alert: true
            }
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if(result) {
                if (isOutTrash) {    // Move to trash
                    this.http.patch({
                        path: 'reports/' + reportId,
                        data: {
                            trash: true
                        }
                    }).subscribe(() => {
                        this.dialog.open(ConfirmationDialogComponent, {
                            width: '410px',
                            data: {
                                title: 'Ha sido eliminado exitosamente el informe:',
                                subtitle: reportName
                            }
                        });
                        this.list.reports.splice(pos, 1);
                        this.folderService.loadFolders();
                        this.folderService.loadStates();
                    });
                } else {    // Delete from database
                    this.http.delete({
                        path: 'reports/' + reportId
                    }).subscribe(() => {
                        this.dialog.open(ConfirmationDialogComponent, {
                            width: '410px',
                            data: {
                                title: 'Ha sido eliminado exitosamente el informe:',
                                subtitle: reportName
                            }
                        });
                        this.list.reports.splice(pos, 1);
                    });
                }
            }
        });
    }

     public openPreviewDialog(idReport: string): void {
        var paramsDialog = {
            width: '80vw',
            height: '80vh',
            data: {
                'reportId': idReport,
                'styles': '',
                'content': ''
            }
        };

        this.dialog.open(PreviewDialogComponent, paramsDialog);
    }

    public openHighlightDialog(id) {
        if (id === '0') {
            const selecteds: Array<string> = this.getCheckboxesSelected();
            id = selecteds[0];
        }
        const found = this.list.reports.find(element => element.id === id);
        const dialogRef = this.dialog.open(HighlightDialogComponent, {
            width: '760px',
            height: '900px',
            data : { 'report' : found }
        });

        dialogRef.afterClosed().subscribe((result: any) => {
            if (result.event === 'save' ) {
                setTimeout(() => {
                    this.openConfirmation();
                    this.updateReports();
                }, 200);
            }

        });
    }

    public canHighlightReport(): boolean {
        if(this.getCheckboxesSelected().length !== 1) return false;
        if(this.icurrentObj.currentState === '5e068c81d811c55eb40d14d0') return true;
        const reportOnly = this.list.reports.filter(
            (a) => a.id == this.getCheckboxesSelected()[0] && a.stateId == '5e068c81d811c55eb40d14d0'
        );
        return reportOnly.length ? true : false;
    }

    public showOptionMenu(state): boolean {
        let found = this.user.roles.findIndex(element => element === 'Admin');
        return state === '5e068c81d811c55eb40d14d0' && found >= 0 ? true : false;
    }

    public isHighlighted(id): boolean {
        let found = this.list.reports.find(element => element.id === id);
        return found.stateId === '5e068c81d811c55eb40d14d0' && found.outstanding ? true : false;
    }

    public openConfirmation(): void {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '410px',
            data: {
                title: 'El informe se ha destacado exitosamente',
                subtitle: ''
            }
        });

        dialogRef.afterClosed().subscribe((result : any) => {
        });
    }

    public updateReports() {
        this.loadReports(this.ifilter);
    }
}

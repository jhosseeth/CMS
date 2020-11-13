import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { AuthService } from '../../../services/auth.service';
import { HttpService } from '../../../services/http.service';
import { SocketService } from '../../../services/socket.service';

import * as moment from 'moment';

@Component({
	selector: 'app-notifications',
	templateUrl: './notifications.component.html',
	styleUrls: ['./notifications.component.scss']
})

export class NotificationsComponent implements OnInit {
	public user: any = {};
	public ntfQty: number = 0;
	public notifications: any = [];
    private stateColors: any = {
        '5e068c81d811c55eb40d14d0': 'bg-publish',
        '5e068d1cb81d1c5f29b62974': 'bg-approved',
        '5e068d1cb81d1c5f29b62975': 'bg-reviewed',
        '5e068d1cb81d1c5f29b62976': 'bg-toReview',
        '5e068d1cb81d1c5f29b62977': 'bg-draft'
    };

	constructor (
        private router: Router,
        private location: Location,
        private auth: AuthService,
		private http: HttpService,
        private socket: SocketService
	) {
        // this.startToListenSockets() // TODO refactory this service for panel
        this.user = this.auth.getUserData();
	}

	ngOnInit() {
        this.getNotifications();
        this.getCountNotifications();
        let _this = this;
        let ntfContainer = document.getElementsByClassName("mat-card-container")[0];
        ntfContainer.addEventListener('scroll', function(e) {
            if((this.scrollHeight - this.scrollTop) === this.offsetHeight) {
                document.getElementsByClassName("loader")[0].classList.remove("hide");
                _this.getNotifications();
            }
        });
	}

    private getNotifications() {
        this.http.get({
            'path': `notifications`,
            'data': {
                order: 'id DESC',
                include: [
                    { relation: "emitter", scope: { fields: ['name'] } },
                    { relation: "report", scope: { fields: ['name', 'stateId'] } }
                ],
                where: { ownerId: this.user.id },
                limit: 15,
                skip: this.notifications.length
            },
            'encode': true
        }).subscribe((response: any) => {
            document.getElementsByClassName("loader")[0].classList.add("hide");
            response.body.map( notification => { this.processNotification(notification) });
        });
    }

    private getCountNotifications(): void {
        this.http.get({
            'path': `notifications/count?where=`,
            'data': {
                    ownerId: this.user.id,
                    readed: false
            }
        }).subscribe((response: any) => {
            this.ntfQty = response.body.count;
        });
    }

    private processNotification(item: any) {
        let timeFromNow: string = moment(item.updatedAt).fromNow();
        let txtDescription: string = item.text
                                    .replace(/{{emitter_name}}/, item.emitter.name)
                                    .replace(/{{report_name}}/, item.report.name);
        let notf: any = {
            id: item.id,
            type: item.type,
            subject: item.subject,
            text: txtDescription,
            timeAgo: timeFromNow,
            readed: item.readed,
            reportId: item.reportId
        };

        if (item.type !== "report-comment" && "report" in item && "stateId" in item.report) {
            notf.bgColor = this.stateColors[item.reportStateId] || 'bg-default';
        }

        this.notifications.push(notf);
    }

    private startToListenSockets() {
        this.socket.start().subscribe(() => {
            this.socket.on("notification").subscribe((response) => {
                this.processNotification(response);
                this.getCountNotifications();
            });
        });
    }

    public openNotification(reportId) {
        this.router.navigate(['app/board', reportId]);
    }

    public goBack() {
        this.location.back();
    }

}